import {
	chmodSync,
	existsSync,
	linkSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type CloudConfig, Session } from "@hashtrack/core";
import { MARK, repoLabel } from "../hooks/brand";
import {
	buildBurst,
	type Cursor,
	parseTranscript,
	pendingLines,
	sessionName,
} from "./transcript";

/** The JSON Claude Code writes to a hook's stdin. Only the fields we read. */
export interface HookInput {
	session_id?: string;
	transcript_path?: string;
	cwd?: string;
	agent_id?: string;
	agent_type?: string;
	agent_transcript_path?: string;
}

export type Action = "start" | "stop" | "subagent-stop" | "end" | "sync";

export interface HookResult {
	output?: { systemMessage: string }; // printed to stdout as JSON
	upload: boolean; // caller should start a detached `sync`
}

const CURSOR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// SessionEnd gets 1.5s in all; the claim under the lock takes milliseconds
const LOCK_WAIT_MS = 1_000;
// A lock with no pid yet (its holder is between creating and writing it) is
// left alone this long; one whose pid is alive, LOCK_MAX_MS (pid reuse)
const LOCK_EMPTY_MS = 5_000;
const LOCK_MAX_MS = 60_000;

function claudeDir(): string {
	return process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

/** Plugin-private state (cursors). Claude Code provides CLAUDE_PLUGIN_DATA; fall back for --plugin-dir runs. */
export function stateDir(): string {
	return process.env.CLAUDE_PLUGIN_DATA || join(claudeDir(), "hashtrack");
}

/** `~/.claude/hashtrack/config.json`: `{ "token": "...", "url"?: "..." }`. */
export function readCloudConfig(): CloudConfig | undefined {
	const file = join(claudeDir(), "hashtrack", "config.json");
	if (!existsSync(file)) return undefined;

	let cfg: { token?: unknown; url?: unknown };
	try {
		cfg = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return undefined;
	}
	if (typeof cfg.token !== "string") return undefined;

	try {
		chmodSync(file, 0o600);
	} catch {}

	return {
		token: cfg.token,
		...(typeof cfg.url === "string" ? { url: cfg.url } : {}),
	};
}

function cursorFile(sessionId: string): string {
	return join(
		stateDir(),
		"cursors",
		`${sessionId.replace(/[^\w.-]/g, "_")}.json`,
	);
}

function readCursor(sessionId: string): Cursor | undefined {
	try {
		const cursor = JSON.parse(readFileSync(cursorFile(sessionId), "utf8"));
		return typeof cursor?.uuid === "string" ? cursor : undefined;
	} catch {
		return undefined;
	}
}

/** Atomic (tmp + rename): a hook killed mid-write leaves the old cursor, never a torn one. */
function writeCursor(sessionId: string, cursor: Cursor): void {
	const file = cursorFile(sessionId);
	mkdirSync(join(file, ".."), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, JSON.stringify(cursor));
	renameSync(tmp, file);
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

/**
 * The lock's inode if its holder is gone: its pid is dead, it never got a
 * pid within LOCK_EMPTY_MS, or it is older than LOCK_MAX_MS. Undefined while
 * it is held (or when it vanished meanwhile).
 */
function staleLock(lock: string): bigint | undefined {
	try {
		const stat = statSync(lock, { bigint: true });
		const age = Date.now() - Number(stat.mtimeMs);
		const pid = Number.parseInt(readFileSync(lock, "utf8"), 10);
		const dead = Number.isInteger(pid) ? !isAlive(pid) : age > LOCK_EMPTY_MS;
		return dead || age > LOCK_MAX_MS ? stat.ino : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Removes the stale lock with inode `ino`, and only that one: it is renamed
 * away first (one rename wins), and if what got renamed is a fresh lock that
 * replaced it in the meantime, that one is put back.
 */
function takeOver(lock: string, ino: bigint): void {
	const grave = `${lock}.${process.pid}.stale`;
	try {
		renameSync(lock, grave);
	} catch {
		return; // another hook took it over first
	}
	try {
		if (statSync(grave, { bigint: true }).ino !== ino) linkSync(grave, lock);
	} catch {
		// a third hook holds the lock already
	}
	rmSync(grave, { force: true });
}

/**
 * Runs `fn` while holding the session's cursor lock: a file next to the
 * cursor, created exclusively, holding the holder's pid. Waits up to
 * `LOCK_WAIT_MS` for another hook; a lock whose holder died is taken over.
 * Gives up (undefined) if the lock stays held: the holder records the burst.
 * The lock never spans a git call, only a transcript read.
 */
export async function withCursorLock<T>(
	sessionId: string,
	fn: () => T,
): Promise<T | undefined> {
	const lock = `${cursorFile(sessionId)}.lock`;
	mkdirSync(join(lock, ".."), { recursive: true });

	const deadline = Date.now() + LOCK_WAIT_MS;
	for (;;) {
		try {
			writeFileSync(lock, String(process.pid), { flag: "wx" });
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
		const stale = staleLock(lock);
		if (stale !== undefined) {
			takeOver(lock, stale);
			continue;
		}
		if (Date.now() >= deadline) return undefined;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}

	try {
		return fn();
	} finally {
		rmSync(lock, { force: true });
	}
}

/** Drop cursors of sessions untouched for a month; a resumed one falls back to its last prompt. */
function pruneCursors(): void {
	const dir = join(stateDir(), "cursors");
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return;
	}
	const cutoff = Date.now() - CURSOR_TTL_MS;
	for (const name of names) {
		const file = join(dir, name);
		try {
			if (statSync(file).mtimeMs < cutoff) rmSync(file);
		} catch {}
	}
}

function readLines(path: string | undefined) {
	if (!path) return undefined;
	try {
		return parseTranscript(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

/**
 * Turn the not-yet-recorded part of a transcript into one record.
 * Writes locally only — uploading is left to a detached `sync`, so a slow
 * network never holds up the prompt (or SessionEnd's 1.5s budget).
 */
async function record(
	input: HookInput,
	{
		transcript,
		cursorKey,
		metadata,
	}: {
		transcript: string | undefined;
		cursorKey?: string;
		metadata?: Record<string, unknown>;
	},
): Promise<boolean> {
	if (!input.session_id) return false;

	// Claim the burst: read what is new and advance the cursor past it. Stop
	// and SessionEnd are separate processes that can run at once, so with a
	// cursor this happens under its lock, and the second one finds nothing
	// new. Advancing before the write means a crash loses a burst rather than
	// recording it twice.
	const claim = () => {
		const lines = readLines(transcript);
		if (!lines) return undefined;
		const burst = buildBurst(
			pendingLines(lines, cursorKey ? readCursor(cursorKey) : undefined),
		);
		if (burst && cursorKey && burst.cursor) {
			writeCursor(cursorKey, burst.cursor);
		}
		return burst && { lines, burst };
	};
	const claimed = cursorKey ? await withCursorLock(cursorKey, claim) : claim();
	if (!claimed) return false;
	const { lines, burst } = claimed;

	const session = new Session({
		sessionId: input.session_id,
		harness: "claude",
		harnessVersion: burst.harnessVersion,
		cwd: input.cwd,
	});
	session.sessionName = sessionName(
		transcript === input.transcript_path
			? lines
			: (readLines(input.transcript_path) ?? []),
	);
	if (metadata) session.addMetadata(metadata);
	for (const skill of burst.skills) session.addSkill(skill);

	session.startAgent({
		dateTimeISOString: burst.startedAt,
		model: burst.model,
	});
	burst.turns.forEach((turn, index) => {
		session.addTurn({ index, ...turn });
	});

	await session.flush();
	return true;
}

export async function runHook(
	action: Action,
	input: HookInput,
): Promise<HookResult> {
	const cloud = readCloudConfig();

	switch (action) {
		case "start": {
			pruneCursors();
			const session = new Session({
				sessionId: input.session_id ?? "",
				harness: "claude",
				cwd: input.cwd,
			});
			return {
				output: {
					systemMessage: `${MARK} Hashtrack · ${repoLabel(session.totalTokens, session.totalCost)}`,
				},
				upload: Boolean(cloud),
			};
		}

		case "stop":
		case "end": {
			const recorded = await record(input, {
				transcript: input.transcript_path,
				cursorKey: input.session_id,
			});
			return { upload: recorded && Boolean(cloud) };
		}

		case "subagent-stop": {
			const recorded = await record(input, {
				transcript: input.agent_transcript_path,
				metadata: {
					agent_id: input.agent_id,
					agent_type: input.agent_type,
				},
			});
			return { upload: recorded && Boolean(cloud) };
		}

		case "sync": {
			if (cloud) {
				await new Session({
					sessionId: input.session_id ?? "",
					harness: "claude",
					cwd: input.cwd,
					cloud,
				}).syncPending();
			}
			return { upload: false };
		}
	}
}
