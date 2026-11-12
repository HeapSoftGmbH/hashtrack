import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export interface Usage {
	in: number; // Input Token
	out: number; // Output Token
	cw: number; // Cache Write
	cr: number; // Cache Read
	tok: number; // Total Tokens
	reason: number; // reasoning
	cst: number; // Total Cost
}

export interface Tool {
	name: string;
	isError: boolean;
	usage?: Usage;
}

interface Turn {
	ti: number; // Turn Index
	tools: Array<Tool>; // Tool Calls
	totalUsage: Usage; // Total Usage
}

export interface CloudConfig {
	url?: string; // API base URL; defaults to DEFAULT_CLOUD_URL
	token?: string; // Bearer token; auth flow added by the caller
}

export interface AgentTurnRecord {
	t: string; // Time
	sid: string; // Session Id
	sn: string; // Session Name
	h: string; // Harness
	hv?: string; // Harness Version
	mod: string; // Model
	turns: Turn[]; // Agent Turns
	skills?: string[]; // Raw skill names invoked during this session
	metadata?: object; // Other Agent Specific Data
	rep: string; // Repository (git remote URL or git root; cwd if not a repo)
	branch?: string; // Git branch at session start
	user?: { name: string; email: string }; // Git user config at session start
}

function git(cwd: string | undefined, cmd: string): string {
	try {
		return execSync(cmd, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			cwd,
		}).trim();
	} catch {
		return "";
	}
}

/** Repository root for a working directory: the git root, else the directory itself. */
export function repoRoot(cwd?: string): string {
	return git(cwd, "git rev-parse --show-toplevel") || cwd || process.cwd();
}

/**
 * Repository identity, exactly as stored in `AgentTurnRecord.rep`:
 * the git remote URL, else the git root (or the working directory).
 */
export function repoIdentity(cwd?: string): string {
	return git(cwd, "git config --get remote.origin.url") || repoRoot(cwd);
}

function rawLines(path: string): string[] {
	try {
		return readFileSync(path, "utf8").split("\n");
	} catch {
		return [];
	}
}

/**
 * Directory that holds the log for one repository root:
 * `<root>/.hashtrack`, or `HASHTRACK_DIR` when set (relative names and
 * absolute paths both work).
 */
function dataDir(root: string): string {
	const override = process.env.HASHTRACK_DIR;
	return override ? resolve(root, override) : join(root, ".hashtrack");
}

/**
 * Directory a reader should use: the current one, or the pre-rename `.witness`
 * directory while the current one does not exist yet, so history written by
 * older adapters keeps showing up.
 */
function recordsDir(root: string): string {
	if (process.env.HASHTRACK_DIR) return dataDir(root);
	const current = join(root, ".hashtrack");
	if (existsSync(current)) return current;
	const legacy = join(root, ".witness");
	return existsSync(legacy) ? legacy : current;
}

/**
 * Move a pre-rename `.witness` directory to `.hashtrack` before the first
 * write, so an upgrade does not split one repo's history across two
 * directories. Skipped for a custom HASHTRACK_DIR and when `.hashtrack`
 * already exists.
 */
function migrateLegacyDir(root: string, target: string): void {
	if (process.env.HASHTRACK_DIR) return;
	const legacy = join(root, ".witness");
	if (existsSync(target) || !existsSync(legacy)) return;
	try {
		renameSync(legacy, target);
	} catch {
		// leave it: readers still fall back to the legacy directory
	}
}

/**
 * Read every record in `<git-root>/.hashtrack`, pending first and synced second.
 * Malformed lines are skipped, so old or partially written records never break a reader.
 * Read-only: unlike the Session constructor, this never creates the directory, and it
 * falls back to the pre-rename `.witness` directory when that is all a repo has.
 */
export function readRepoRecords(cwd?: string): AgentTurnRecord[] {
	return readHashtrackRecords(repoRoot(cwd));
}

/**
 * Read every record in `<root>/.hashtrack` for a directory that is already a repository
 * root, so readers that resolved the root themselves do not run git twice.
 */
export function readHashtrackRecords(root: string): AgentTurnRecord[] {
	const { pending, synced } = recordsFiles(root);
	return parseRecords([...rawLines(pending), ...rawLines(synced)]);
}

/** The two log files in a data directory: the pending queue and the archive. */
interface LogFiles {
	pending: string;
	synced: string;
}

/** The one place the log's file names are spelled out. */
function logFiles(dir: string): LogFiles {
	return {
		pending: join(dir, "usage.jsonl"),
		synced: join(dir, "synced.jsonl"),
	};
}

/** The log files a reader of `<root>` uses, from the directory `recordsDir` picks. */
function recordsFiles(root: string): LogFiles {
	return logFiles(recordsDir(root));
}

/** Parse JSONL lines into records, skipping blank and malformed ones. */
function parseRecords(lines: Iterable<string>): AgentTurnRecord[] {
	const records: AgentTurnRecord[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			records.push(JSON.parse(line) as AgentTurnRecord);
		} catch {
			// skip malformed line
		}
	}
	return records;
}

/** Tokens, dollars and turns, summed. */
export interface TurnTotals {
	tokens: number;
	cost: number;
	turns: number;
}

/**
 * Running sums over records, kept whole (no ranking, no cut-off) so that
 * tallies of separate parts, say two files, merge into the tally of all of
 * them. Readers derive what they show from it.
 */
export interface UsageTally extends TurnTotals {
	records: number;
	/** Every session id seen, including records without turns. */
	sessions: Map<string, TurnTotals>;
	/** Dollars per model (`mod`); records without one are left out. */
	models: Map<string, number>;
	/** Calls and errors per raw tool name. */
	tools: Map<string, { calls: number; errors: number }>;
}

export function emptyTotals(): TurnTotals {
	return { tokens: 0, cost: 0, turns: 0 };
}

export function emptyTally(): UsageTally {
	return {
		records: 0,
		...emptyTotals(),
		sessions: new Map(),
		models: new Map(),
		tools: new Map(),
	};
}

/** Add `records` to `tally` (a new one by default) and return it. */
export function tallyRecords(
	records: Iterable<AgentTurnRecord>,
	tally: UsageTally = emptyTally(),
): UsageTally {
	for (const record of records) {
		tally.records += 1;
		const session = tally.sessions.get(record.sid) ?? emptyTotals();
		tally.sessions.set(record.sid, session);

		for (const turn of record.turns ?? []) {
			const tokens = Number(turn.totalUsage?.tok) || 0;
			const cost = Number(turn.totalUsage?.cst) || 0;
			for (const totals of [tally, session]) {
				totals.tokens += tokens;
				totals.cost += cost;
				totals.turns += 1;
			}
			if (record.mod) {
				tally.models.set(
					record.mod,
					(tally.models.get(record.mod) ?? 0) + cost,
				);
			}
			for (const tool of turn.tools ?? []) {
				const entry = tally.tools.get(tool.name) ?? { calls: 0, errors: 0 };
				entry.calls += 1;
				if (tool.isError) entry.errors += 1;
				tally.tools.set(tool.name, entry);
			}
		}
	}
	return tally;
}

/** One tally covering every part; the parts are left as they are. */
export function mergeTallies(...parts: UsageTally[]): UsageTally {
	const all = emptyTally();
	for (const part of parts) {
		all.records += part.records;
		all.tokens += part.tokens;
		all.cost += part.cost;
		all.turns += part.turns;
		for (const [sid, s] of part.sessions) {
			const into = all.sessions.get(sid) ?? emptyTotals();
			all.sessions.set(sid, {
				tokens: into.tokens + s.tokens,
				cost: into.cost + s.cost,
				turns: into.turns + s.turns,
			});
		}
		for (const [mod, cost] of part.models) {
			all.models.set(mod, (all.models.get(mod) ?? 0) + cost);
		}
		for (const [name, t] of part.tools) {
			const into = all.tools.get(name) ?? { calls: 0, errors: 0 };
			all.tools.set(name, {
				calls: into.calls + t.calls,
				errors: into.errors + t.errors,
			});
		}
	}
	return all;
}

/** How far one log file has been read, and the tally of what was read. */
interface FileTally {
	ino: string;
	offset: number;
	tally: UsageTally;
}

/** One file brought up to date: its cache entry, plus a last line with no newline yet. */
interface FileRead {
	file: FileTally;
	size: number;
	tail: AgentTurnRecord[];
}

/** A tally as stored in a cache file: Maps as entry lists. */
interface StoredFile {
	ino: string;
	offset: number;
	tally: Omit<UsageTally, "sessions" | "models" | "tools"> & {
		sessions: Array<[string, TurnTotals]>;
		models: Array<[string, number]>;
		tools: Array<[string, { calls: number; errors: number }]>;
	};
}

interface RepoTallyCache {
	pending?: FileTally;
	synced?: FileTally;
}

const NEWLINE = 0x0a;

function storeFile({ ino, offset, tally }: FileTally): StoredFile {
	return {
		ino,
		offset,
		tally: {
			...tally,
			sessions: [...tally.sessions],
			models: [...tally.models],
			tools: [...tally.tools],
		},
	};
}

function restoreFile(stored: StoredFile | undefined): FileTally | undefined {
	if (
		typeof stored?.ino !== "string" ||
		typeof stored.offset !== "number" ||
		!Array.isArray(stored.tally?.sessions) ||
		!Array.isArray(stored.tally.models) ||
		!Array.isArray(stored.tally.tools)
	) {
		return undefined;
	}
	return {
		ino: stored.ino,
		offset: stored.offset,
		tally: {
			...stored.tally,
			sessions: new Map(stored.tally.sessions),
			models: new Map(stored.tally.models),
			tools: new Map(stored.tally.tools),
		},
	};
}

function readBytes(file: string, from: number, length: number): Buffer {
	const bytes = Buffer.alloc(length);
	const fd = openSync(file, "r");
	let read = 0;
	try {
		while (read < length) {
			const n = readSync(fd, bytes, read, length - read, from + read);
			if (n === 0) break;
			read += n;
		}
	} finally {
		closeSync(fd);
	}
	return bytes.subarray(0, read);
}

/**
 * Brings one file's tally up to date. The log is append-only, so while the
 * file is the same one (inode) and has not shrunk, only the bytes after the
 * last read are parsed; a rewrite (the upload's tmp + rename) or truncation
 * starts over. The cached part stops at the last newline, so a line still
 * being written is picked up whole later; a last line that already parses
 * (a file that ends without a newline) still counts, in `tail`.
 */
function advance(
	file: string,
	cached: FileTally | undefined,
): FileRead | undefined {
	let ino: string;
	let size: number;
	try {
		const stat = statSync(file, { bigint: true });
		ino = `${stat.dev}:${stat.ino}`;
		size = Number(stat.size);
	} catch {
		return undefined; // no file, nothing to count
	}

	const base =
		cached && cached.ino === ino && cached.offset <= size
			? cached
			: { ino, offset: 0, tally: emptyTally() };
	if (base.offset === size) return { file: base, size, tail: [] };

	const bytes = readBytes(file, base.offset, size - base.offset);
	const end = bytes.lastIndexOf(NEWLINE) + 1;
	const tail = parseRecords([bytes.subarray(end).toString("utf8")]);
	if (end === 0) return { file: base, size, tail };
	const lines = bytes.subarray(0, end).toString("utf8").split("\n");
	return {
		file: {
			ino,
			offset: base.offset + end,
			tally: tallyRecords(parseRecords(lines), base.tally),
		},
		size,
		tail,
	};
}

function readTallyCache(cacheFile: string): RepoTallyCache {
	try {
		const stored = JSON.parse(readFileSync(cacheFile, "utf8")) ?? {};
		return {
			pending: restoreFile(stored.pending),
			synced: restoreFile(stored.synced),
		};
	} catch {
		return {};
	}
}

function writeTallyCache(cacheFile: string, cache: RepoTallyCache): void {
	try {
		mkdirSync(join(cacheFile, ".."), { recursive: true });
		const tmp = `${cacheFile}.${process.pid}.tmp`;
		writeFileSync(
			tmp,
			JSON.stringify({
				...(cache.pending ? { pending: storeFile(cache.pending) } : {}),
				...(cache.synced ? { synced: storeFile(cache.synced) } : {}),
			}),
		);
		renameSync(tmp, cacheFile);
	} catch {
		// a cache that cannot be written only costs a full read next time
	}
}

/** In-process caches, by pending file: the file tallies and the last result. */
const repoTallies = new Map<
	string,
	{ cache: RepoTallyCache; key: string; tally: UsageTally }
>();

/**
 * The tally of every record a reader of `<root>` sees (the same records as
 * `readHashtrackRecords`), for readers that ask often: each log file is
 * parsed only from where the last call stopped.
 *
 * Without `cacheDir` the running tallies live in this process, and while no
 * file changed the same tally object comes back. With `cacheDir` they are kept
 * in a file there (one per log directory) instead, for readers that run as a
 * fresh process each time. The returned tally is the caller's to read, not to
 * change.
 */
export function repoTally(root: string, cacheDir?: string): UsageTally {
	const files = recordsFiles(root);
	const cacheFile =
		cacheDir &&
		join(
			cacheDir,
			`${createHash("sha256").update(files.pending).digest("hex").slice(0, 32)}.json`,
		);
	const memo = cacheFile ? undefined : repoTallies.get(files.pending);
	const cached = cacheFile ? readTallyCache(cacheFile) : (memo?.cache ?? {});

	const pending = advance(files.pending, cached.pending);
	const synced = advance(files.synced, cached.synced);
	const key = [pending, synced]
		.map((r) => (r ? `${r.file.ino}:${r.size}` : "-"))
		.join("|");
	if (memo?.key === key) return memo.tally;

	const cache = { pending: pending?.file, synced: synced?.file };
	const reads = [pending, synced].flatMap((r) => (r ? [r] : []));
	const tally = mergeTallies(
		...reads.map((r) => r.file.tally),
		tallyRecords(reads.flatMap((r) => r.tail)),
	);
	if (cacheFile) writeTallyCache(cacheFile, cache);
	else repoTallies.set(files.pending, { cache, key, tally });
	return tally;
}

export interface RecordsResult {
	records: AgentTurnRecord[];
	source: "cloud" | "local";
}

export interface CloudRecordsQuery {
	rep: string; // repository identity, as stored in AgentTurnRecord.rep
	since?: string; // ISO timestamp; inclusive lower bound
	until?: string; // ISO timestamp; inclusive upper bound
}

/**
 * Pull one repository's records from the hashtrack cloud API.
 *
 * Returns `undefined` when cloud sync is not configured or the request fails,
 * so callers can fall back to the local log. An empty array is a valid answer:
 * the token works, the repository simply has no records on the server.
 */
export async function readCloudRecords(
	cloud: CloudConfig | undefined,
	{ rep, since, until }: CloudRecordsQuery,
): Promise<AgentTurnRecord[] | undefined> {
	const { token, url } = cloud ?? {};
	if (!token || !url || !rep) return undefined;

	const params = new URLSearchParams({ rep });
	if (since) params.set("since", since);
	if (until) params.set("until", until);

	try {
		const response = await fetch(
			`${url.replace(/\/$/, "")}/api/records?${params}`,
			{
				headers: { authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(4_000),
			},
		);
		if (!response.ok) return undefined;

		const body = (await response.json()) as { records?: unknown };
		return Array.isArray(body?.records)
			? (body.records as AgentTurnRecord[])
			: undefined;
	} catch {
		// best-effort: a reader without a connection still shows the local log
		return undefined;
	}
}

/**
 * Records for a repository, preferring the cloud when a token is configured.
 * Falls back to `.hashtrack` when the cloud is not configured or unreachable.
 */
export async function resolveRepoRecords({
	cwd,
	cloud,
	since,
	until,
}: {
	cwd?: string;
	cloud?: CloudConfig;
	since?: string;
	until?: string;
} = {}): Promise<RecordsResult> {
	if (!cloud?.token) return { records: readRepoRecords(cwd), source: "local" };

	const remote = await readCloudRecords(cloud, {
		rep: repoIdentity(cwd),
		since,
		until,
	});
	if (remote) return { records: remote, source: "cloud" };
	return { records: readRepoRecords(cwd), source: "local" };
}

export class Session {
	public sessionName: string = "";
	public totalTokens: number = 0;
	public totalCost: number = 0;
	public readonly sessionId: string = "";

	private lastModel: string = "";
	private currentAgentTurn?: AgentTurnRecord;
	private metadata: Record<string, unknown> = {};
	private skills: string[] = [];
	private readonly harness: string = "";
	private readonly harnessVersion?: string;
	private readonly path: string;
	private readonly files: LogFiles;
	private readonly rep: string;
	private readonly branch: string;
	private readonly user: { name: string; email: string };
	private readonly cloud?: CloudConfig = {
		url: "https://hashtrack.ai",
	};
	private readonly cwd?: string;

	constructor({
		sessionId,
		harness,
		harnessVersion,
		cloud,
		cwd,
	}: {
		sessionId: string;
		harness: string;
		harnessVersion?: string;
		cloud?: CloudConfig;
		cwd?: string; // directory the harness ran in; defaults to process.cwd()
	}) {
		this.sessionId = sessionId;
		this.harness = harness;
		this.harnessVersion = harnessVersion;
		this.cloud = { ...this.cloud, ...cloud };
		this.cwd = cwd;

		const root = this.gitRoot();
		this.rep = repoIdentity(this.cwd);
		this.branch = this.gitBranch();
		this.user = this.gitUser();

		this.path = dataDir(root);
		migrateLegacyDir(root, this.path);
		this.files = logFiles(this.path);
		mkdirSync(this.path, { recursive: true });
		this.loadHistory();
	}

	private git(cmd: string): string {
		return git(this.cwd, cmd);
	}

	private gitRoot(): string {
		return repoRoot(this.cwd);
	}

	private gitBranch(): string {
		return this.git("git branch --show-current");
	}

	private gitUser(): { name: string; email: string } {
		const get = (key: string): string => this.git(`git config --get ${key}`);
		return { name: get("user.name"), email: get("user.email") };
	}

	public readRecords(): AgentTurnRecord[] {
		return readRepoRecords(this.cwd);
	}

	private archive(lines: string[]): void {
		const moved = new Set(lines);
		appendFileSync(
			this.files.synced,
			lines.map((line) => `${line}\n`).join(""),
		);
		const file = this.files.pending;
		const kept = rawLines(file).filter((line) => !moved.has(line));
		writeFileSync(`${file}.tmp`, kept.join("\n"));
		renameSync(`${file}.tmp`, file);
	}

	public async syncPending(): Promise<void> {
		const pending: { line: string; record: AgentTurnRecord }[] = [];
		for (const line of rawLines(this.files.pending)) {
			try {
				pending.push({ line, record: JSON.parse(line) as AgentTurnRecord });
			} catch {
				// skip malformed line
			}
		}
		if (pending.length === 0) return;
		if (await this.ingest(pending.map((p) => p.record))) {
			this.archive(pending.map((p) => p.line));
		}
	}

	private loadHistory() {
		const tally = tallyRecords(this.readRecords());
		this.totalTokens += tally.tokens;
		this.totalCost += tally.cost;
	}

	public addMetadata(data: Record<string, unknown>) {
		this.metadata = { ...this.metadata, ...data };
	}

	public startAgent({
		dateTimeISOString,
		model,
	}: {
		dateTimeISOString: string;
		model: string;
	}) {
		this.lastModel = model;
		this.currentAgentTurn = {
			t: dateTimeISOString,
			sid: this.sessionId,
			sn: this.sessionName,
			h: this.harness,
			mod: model,
			hv: this.harnessVersion,
			rep: this.rep,
			branch: this.branch,
			user: this.user,
			turns: [],
		};
	}

	public addSkill(name: string) {
		this.skills.push(name);
	}

	public addTurn({
		index,
		tools,
		totalUsage,
	}: {
		index?: number;
		tools: Tool[];
		totalUsage: Usage;
	}) {
		this.totalTokens += totalUsage.tok;
		this.totalCost += totalUsage.cst;

		if (!this.currentAgentTurn) {
			this.startAgent({
				dateTimeISOString: new Date().toISOString(),
				model: this.lastModel,
			});
		}

		this.currentAgentTurn?.turns.push({ ti: index || 0, tools, totalUsage });
	}

	public async flush(): Promise<void> {
		if (!this.currentAgentTurn) return;

		this.currentAgentTurn.metadata = this.metadata;
		this.currentAgentTurn.skills = this.skills;
		this.currentAgentTurn.sn = this.sessionName;

		const record = this.currentAgentTurn;
		const line = JSON.stringify(record);
		appendFileSync(this.files.pending, `${line}\n`);
		this.currentAgentTurn = undefined;

		if (await this.ingest([record])) this.archive([line]);
	}

	private async ingest(records: AgentTurnRecord[]): Promise<boolean> {
		const { token, url } = this.cloud ?? {};
		if (!token || !url || records.length === 0) return false;

		try {
			const chunks: AgentTurnRecord[][] = [];
			for (let i = 0; i < records.length; i += 500)
				chunks.push(records.slice(i, i + 500));

			const responses = await Promise.all(
				chunks.map((chunk) =>
					fetch(`${url.replace(/\/$/, "")}/api/ingest`, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({ records: chunk }),
						signal: AbortSignal.timeout(4_000),
					}),
				),
			);
			return responses.every((res) => res.ok);
		} catch {
			// shortcut: ingest is best-effort; a failed record stays in usage.jsonl for the next startup
			return false;
		}
	}
}
