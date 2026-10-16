import { execSync } from "node:child_process";
import {
	appendFileSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

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

	constructor({
		sessionId,
		harness,
		harnessVersion,
		cloud,
	}: {
		sessionId: string;
		harness: string;
		harnessVersion?: string;
		cloud?: CloudConfig;
	}) {
		this.sessionId = sessionId;
		this.harness = harness;
		this.harnessVersion = harnessVersion;
		this.cloud = { ...this.cloud, ...cloud };

		const root = this.gitRoot();
		this.rep = this.gitRemote() ?? root;
		this.branch = this.gitBranch();
		this.user = this.gitUser();

		this.path = join(root, ".witness");
		this.fileName = "usage.jsonl";
		this.syncedFileName = "synced.jsonl";
		mkdirSync(this.path, { recursive: true });
		this.loadHistory();
	}

	private git(cmd: string): string {
		try {
			return execSync(cmd, {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}).trim();
		} catch {
			return "";
		}
	}

	private gitRoot(): string {
		return this.git("git rev-parse --show-toplevel") || process.cwd();
	}

	private gitRemote(): string | undefined {
		return this.git("git config --get remote.origin.url") || undefined;
	}

	private gitBranch(): string {
		return this.git("git branch --show-current");
	}

	private gitUser(): { name: string; email: string } {
		const get = (key: string): string => this.git(`git config --get ${key}`);
		return { name: get("user.name"), email: get("user.email") };
	}

	public readRecords(): AgentTurnRecord[] {
		const records: AgentTurnRecord[] = [];
		const lines = [
			...this.rawLines(this.fileName),
			...this.rawLines(this.syncedFileName),
		];
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

	private rawLines(fileName: string): string[] {
		try {
			return readFileSync(join(this.path, fileName), "utf8").split("\n");
		} catch {
			return [];
		}
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
		if (!this.cloud?.token || !this.cloud.url || records.length === 0)
			return false;
		try {
			const res = await fetch(
				`${(this.cloud.url).replace(/\/$/, "")}/api/ingest`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${this.cloud.token}`,
					},
					body: JSON.stringify({ records }),
					signal: AbortSignal.timeout(4_000),
				},
			);
			return res.ok;
		} catch {
			// shortcut: ingest is best-effort; a failed record stays in usage.jsonl for the next startup
			return false;
		}
	}
}
