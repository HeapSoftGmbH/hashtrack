import { execSync } from "node:child_process";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
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
	const path = recordsDir(root);
	const records: AgentTurnRecord[] = [];
	for (const line of [
		...rawLines(join(path, "usage.jsonl")),
		...rawLines(join(path, "synced.jsonl")),
	]) {
		if (!line.trim()) continue;
		try {
			records.push(JSON.parse(line) as AgentTurnRecord);
		} catch {
			// skip malformed line
		}
	}
	return records;
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
	private readonly fileName: string;
	private readonly syncedFileName: string;
	private readonly rep: string;
	private readonly branch: string;
	private readonly user: { name: string; email: string };
	private readonly cloud?: CloudConfig = {
		url: "https://witness-rho-rust.vercel.app",
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
		this.fileName = "usage.jsonl";
		this.syncedFileName = "synced.jsonl";
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

	private rawLines(fileName: string): string[] {
		return rawLines(join(this.path, fileName));
	}

	private archive(lines: string[]): void {
		const moved = new Set(lines);
		appendFileSync(
			join(this.path, this.syncedFileName),
			lines.map((line) => `${line}\n`).join(""),
		);
		const file = join(this.path, this.fileName);
		const kept = this.rawLines(this.fileName).filter(
			(line) => !moved.has(line),
		);
		writeFileSync(`${file}.tmp`, kept.join("\n"));
		renameSync(`${file}.tmp`, file);
	}

	public async syncPending(): Promise<void> {
		const pending: { line: string; record: AgentTurnRecord }[] = [];
		for (const line of this.rawLines(this.fileName)) {
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
		for (const rec of this.readRecords()) {
			for (const turn of rec.turns ?? []) {
				this.totalTokens += Number(turn.totalUsage?.tok) || 0;
				this.totalCost += Number(turn.totalUsage?.cst) || 0;
			}
		}
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
		appendFileSync(join(this.path, this.fileName), `${line}\n`);
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
