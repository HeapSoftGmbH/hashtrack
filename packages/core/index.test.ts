import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type AgentTurnRecord,
	readCloudRecords,
	readRepoRecords,
	repoIdentity,
	resolveRepoRecords,
	Session,
	type Usage,
} from "./index";

const usage = (tok: number, cst: number): Usage => ({
	in: 0,
	out: 0,
	cw: 0,
	cr: 0,
	tok,
	reason: 0,
	cst,
});

const hashtrackFile = () => join(cwd, ".hashtrack", "usage.jsonl");

const rec = (sid: string): AgentTurnRecord => ({
	t: "2026-01-01T00:00:00Z",
	sid,
	sn: "",
	h: "pi",
	mod: "m",
	rep: cwd,
	turns: [{ ti: 0, tools: [], totalUsage: usage(1, 0.01) }],
});

let cwd: string;
let prevCwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "hashtrack-cwd-"));
	prevCwd = process.cwd();
	process.chdir(cwd);
	cwd = process.cwd();
});

afterEach(() => {
	process.chdir(prevCwd);
	rmSync(cwd, { recursive: true, force: true });
});

describe("loadHistory", () => {
	test("sums repo totals, skips malformed lines", () => {
		const valid: AgentTurnRecord = {
			t: new Date().toISOString(),
			sid: "old-session",
			sn: "",
			h: "pi",
			mod: "m",
			rep: cwd,
			turns: [
				{ ti: 0, tools: [], totalUsage: usage(100, 0.5) },
				{ ti: 1, tools: [], totalUsage: usage(50, 0.25) },
			],
		};
		const foreign = { ...valid, rep: "https://github.com/other/repo" };
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(
			hashtrackFile(),
			`${JSON.stringify(valid)}\nnot json at all\n${JSON.stringify(foreign)}\n\n`,
		);

		const session = new Session({ sessionId: "s1", harness: "pi" });
		expect(session.totalTokens).toBe(300);
		expect(session.totalCost).toBe(1.5);
	});

	test("retry turn after flush is not dropped", () => {
		const session = new Session({ sessionId: "s1", harness: "pi" });
		session.startAgent({
			dateTimeISOString: "2026-01-01T00:00:00Z",
			model: "m1",
		});
		session.addTurn({ index: 0, tools: [], totalUsage: usage(10, 0.1) });
		session.flush();

		// retry attempt lands after agent_settled flushed the burst
		session.addTurn({ index: 0, tools: [], totalUsage: usage(20, 0.2) });
		session.flush();

		const lines = readFileSync(hashtrackFile(), "utf8").trim().split("\n");
		expect(lines).toHaveLength(2);
		const rec = JSON.parse(lines[1] ?? "") as AgentTurnRecord;
		expect(rec.turns).toHaveLength(1);
		expect(rec.mod).toBe("m1"); // model remembered from last startAgent
		expect(session.totalCost).toBeCloseTo(0.3);
	});
});

describe("readRepoRecords", () => {
	test("returns pending records before synced ones", () => {
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		// earlier timestamps after the first line: file order, not a descending `t` sort
		writeFileSync(
			hashtrackFile(),
			`${JSON.stringify(rec("earlier-pending"))}\n${JSON.stringify({ ...rec("pending"), t: "2026-01-02T00:00:00Z" })}\n`,
		);
		writeFileSync(
			join(cwd, ".hashtrack", "synced.jsonl"),
			`${JSON.stringify({ ...rec("synced"), t: "2026-01-01T00:00:00Z" })}\n`,
		);

		expect(readRepoRecords(cwd).map((r) => r.sid)).toEqual([
			"earlier-pending",
			"pending",
			"synced",
		]);
	});
});

describe("addTurn + flush", () => {
	test("flush appends one record and clears the current turn", () => {
		const session = new Session({ sessionId: "s1", harness: "pi" });
		session.sessionName = "my session";
		session.startAgent({
			dateTimeISOString: "2026-01-01T00:00:00Z",
			model: "m1",
		});
		session.addMetadata({ foo: "bar" });
		session.addSkill("shadcn-svelte");
		session.addSkill("ponytail");
		session.addTurn({
			index: 3,
			tools: [{ name: "read", isError: false }],
			totalUsage: usage(10, 0.1),
		});
		session.addTurn({ tools: [], totalUsage: usage(5, 0.05) });

		expect(session.totalTokens).toBe(15);
		expect(session.totalCost).toBeCloseTo(0.15);

		session.flush();
		session.flush(); // second flush is a no-op

		const lines = readFileSync(hashtrackFile(), "utf8").trim().split("\n");
		expect(lines).toHaveLength(1);
		const rec = JSON.parse(lines[0] as string) as AgentTurnRecord;
		expect(rec.sid).toBe("s1");
		expect(rec.sn).toBe("my session");
		expect(rec.h).toBe("pi");
		expect(rec.mod).toBe("m1");
		expect(rec.rep).toBe(cwd);
		expect(rec.metadata).toEqual({ foo: "bar" });
		expect(rec.skills).toEqual(["shadcn-svelte", "ponytail"]);
		expect(rec.turns).toHaveLength(2);
		expect(rec.turns?.[0]?.ti).toBe(3);
		expect(rec.turns?.[1]?.ti).toBe(0); // missing index defaults to 0
		expect(rec.turns?.[0]?.tools[0]?.name).toBe("read");
	});

	test("addTurn before startAgent: totals count, auto-starts a record so flush persists", () => {
		const session = new Session({ sessionId: "s1", harness: "pi" });
		session.startAgent({
			dateTimeISOString: "2026-01-01T00:00:00Z",
			model: "m1",
		});
		session.flush();
		session.addTurn({ tools: [], totalUsage: usage(7, 0.07) });
		expect(session.totalTokens).toBe(7);
		session.flush();
		const lines = readFileSync(hashtrackFile(), "utf8").trim().split("\n");
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[1] ?? "") as AgentTurnRecord).toMatchObject({
			mod: "m1",
			turns: [{ ti: 0, totalUsage: { tok: 7, cst: 0.07 } }],
		});
	});

	test("totals combine history and new turns, history file preserved", () => {
		const old: AgentTurnRecord = {
			t: "2026-01-01T00:00:00Z",
			sid: "old",
			sn: "",
			h: "pi",
			mod: "m",
			rep: cwd,
			turns: [{ ti: 0, tools: [], totalUsage: usage(100, 1) }],
		};
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(hashtrackFile(), `${JSON.stringify(old)}\n`);

		const session = new Session({ sessionId: "s2", harness: "pi" });
		session.startAgent({
			dateTimeISOString: "2026-01-02T00:00:00Z",
			model: "m",
		});
		session.addTurn({ tools: [], totalUsage: usage(1, 0.01) });
		session.flush();

		expect(session.totalTokens).toBe(101);
		expect(
			readFileSync(hashtrackFile(), "utf8").trim().split("\n"),
		).toHaveLength(2);
	});
});

describe("cloud read", () => {
	const originalFetch = globalThis.fetch;
	let calls: { url: string; init?: RequestInit }[] = [];

	beforeEach(() => {
		calls = [];
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const remote = (sid: string): AgentTurnRecord => ({
		...rec(sid),
		rep: "https://github.com/example/repo",
	});

	const respond = (body: unknown, status = 200) => {
		globalThis.fetch = ((url: string, init?: RequestInit) => {
			calls.push({ url, init });
			return Promise.resolve(Response.json(body, { status }));
		}) as unknown as typeof fetch;
	};

	test("repoIdentity falls back to the working directory", () => {
		expect(repoIdentity(cwd)).toBe(cwd);
	});

	test("no token: no request", async () => {
		globalThis.fetch = (() => {
			throw new Error("should not fetch");
		}) as unknown as typeof fetch;

		expect(
			await readCloudRecords(
				{ url: "https://api.example.com" },
				{ rep: "repo" },
			),
		).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	test("pulls records for one repo, with bearer auth and a range", async () => {
		respond({ records: [remote("one")] });

		const records = await readCloudRecords(
			{ url: "https://api.example.com/", token: "tok" },
			{
				rep: "https://github.com/example/repo",
				since: "2026-01-01T00:00:00.000Z",
				until: "2026-02-01T00:00:00.000Z",
			},
		);

		expect(records?.map((r) => r.sid)).toEqual(["one"]);
		expect(calls[0]?.url).toContain("https://api.example.com/api/records?");
		expect(calls[0]?.url).toContain(
			"rep=https%3A%2F%2Fgithub.com%2Fexample%2Frepo",
		);
		expect(calls[0]?.url).toContain("since=2026-01-01T00%3A00%3A00.000Z");
		expect(calls[0]?.url).toContain("until=2026-02-01T00%3A00%3A00.000Z");
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer tok");
		expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
	});

	test("uses the cloud even when it has no records, instead of local ones", async () => {
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(hashtrackFile(), `${JSON.stringify(rec("local"))}\n`);
		respond({ records: [] });

		const result = await resolveRepoRecords({
			cwd,
			cloud: { url: "https://api.example.com", token: "tok" },
		});

		expect(result.source).toBe("cloud");
		expect(result.records).toEqual([]);
	});

	test("falls back to local records when the request fails", async () => {
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(hashtrackFile(), `${JSON.stringify(rec("local"))}\n`);
		respond({ error: "nope" }, 500);

		const result = await resolveRepoRecords({
			cwd,
			cloud: { url: "https://api.example.com", token: "tok" },
		});

		expect(result.source).toBe("local");
		expect(result.records.map((r) => r.sid)).toEqual(["local"]);
	});

	test("falls back to local records on a malformed response", async () => {
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(hashtrackFile(), `${JSON.stringify(rec("local"))}\n`);
		respond({ records: "nope" });

		const result = await resolveRepoRecords({
			cwd,
			cloud: { url: "https://api.example.com", token: "tok" },
		});

		expect(result.source).toBe("local");
		expect(result.records.map((r) => r.sid)).toEqual(["local"]);
	});

	test("no cloud config: reads local records", async () => {
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(hashtrackFile(), `${JSON.stringify(rec("local"))}\n`);

		const result = await resolveRepoRecords({ cwd });

		expect(result.source).toBe("local");
		expect(result.records.map((r) => r.sid)).toEqual(["local"]);
	});
});

describe("cloud upload", () => {
	const originalFetch = globalThis.fetch;
	let calls: { url: string; init?: RequestInit }[] = [];

	beforeEach(() => {
		calls = [];
		globalThis.fetch = ((url: string, init?: RequestInit) => {
			calls.push({ url, init });
			return Promise.resolve(new Response("{}"));
		}) as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const cloudSession = () =>
		new Session({
			sessionId: "s1",
			harness: "pi",
			cloud: { url: "https://api.example.com/", token: "tok" },
		});

	const stored = (file = "usage.jsonl") =>
		readFileSync(join(cwd, ".hashtrack", file), "utf8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((l: string) => JSON.parse(l) as AgentTurnRecord);

	const sent = (i: number) =>
		JSON.parse(String(calls[i]?.init?.body)) as { records: AgentTurnRecord[] };

	test("flush posts the record, then moves it out of usage.jsonl", async () => {
		const session = cloudSession();
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(10, 0.1) });
		await session.flush();

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://api.example.com/api/ingest");
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer tok");
		expect(sent(0).records[0]).toMatchObject({ sid: "s1", mod: "m" });
		expect(stored("usage.jsonl")).toEqual([]);
		expect(stored("synced.jsonl")[0]).toMatchObject({ sid: "s1", mod: "m" });
		expect(session.readRecords()).toHaveLength(1); // dashboard still sees it
	});

	test("upload carries an abort timeout", async () => {
		const session = cloudSession();
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(10, 0.1) });
		await session.flush();
		const signal = calls[0]?.init?.signal;
		expect(signal).toBeInstanceOf(AbortSignal);
		expect(signal?.aborted).toBe(false);
	});

	test("token only: uses the built-in default API base", async () => {
		const session = new Session({
			sessionId: "s1",
			harness: "pi",
			cloud: { token: "tok" },
		});
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(10, 0.1) });
		await session.flush();
		expect(calls[0]?.url).toBe(
			"https://witness-rho-rust.vercel.app/api/ingest",
		);
	});

	test("no token: no request, record stays pending", async () => {
		const session = new Session({
			sessionId: "s1",
			harness: "pi",
			cloud: { url: "https://api.example.com" },
		});
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(10, 0.1) });
		await session.flush();
		expect(calls).toHaveLength(0);
		expect(stored("usage.jsonl")).toHaveLength(1);
	});

	test("no cloud config: no request, record stays in usage.jsonl", async () => {
		const session = new Session({ sessionId: "s1", harness: "pi" });
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(10, 0.1) });
		await session.flush();
		expect(calls).toHaveLength(0);
		expect(stored("usage.jsonl")).toHaveLength(1);
	});

	test("failed upload keeps the record pending", async () => {
		globalThis.fetch = (() =>
			Promise.reject(new Error("offline"))) as unknown as typeof fetch;
		const session = cloudSession();
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(10, 0.1) });
		await session.flush();
		expect(readFileSync(hashtrackFile(), "utf8")).toContain('"sid":"s1"');
		expect(() => stored("synced.jsonl")).toThrow(); // never created
	});

	test("syncPending batches usage.jsonl, archives it, keeps malformed lines", async () => {
		const session = cloudSession();
		const one = rec("one");
		const two = rec("two");
		writeFileSync(
			hashtrackFile(),
			`${JSON.stringify(one)}\nnot json\n${JSON.stringify(two)}\n`,
		);

		await session.syncPending();

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://api.example.com/api/ingest");
		expect(sent(0).records.map((r) => r.sid)).toEqual(["one", "two"]);
		expect(readFileSync(hashtrackFile(), "utf8")).toBe("not json\n");
		expect(stored("synced.jsonl").map((r: AgentTurnRecord) => r.sid)).toEqual([
			"one",
			"two",
		]);
		expect(session.readRecords().map((r: AgentTurnRecord) => r.sid)).toEqual([
			"one",
			"two",
		]);
	});

	test("syncPending splits 501 records into 500 + 1 requests", async () => {
		const session = cloudSession();
		const lines = Array.from({ length: 501 }, (_, i) =>
			JSON.stringify(rec(`s${i}`)),
		);
		writeFileSync(hashtrackFile(), `${lines.join("\n")}\n`);

		await session.syncPending();

		expect(calls).toHaveLength(2);
		expect(sent(0).records).toHaveLength(500);
		expect(sent(1).records).toHaveLength(1);
		expect(stored("synced.jsonl")).toHaveLength(501);
		expect(stored("usage.jsonl")).toEqual([]);
	});

	test("chunks are uploaded in parallel", async () => {
		let inFlight = 0;
		let peak = 0;
		globalThis.fetch = (() => {
			peak = Math.max(peak, ++inFlight);
			return new Promise<Response>((resolve) =>
				setTimeout(() => {
					inFlight--;
					resolve(new Response("{}"));
				}, 5),
			);
		}) as unknown as typeof fetch;

		const session = cloudSession();
		writeFileSync(
			hashtrackFile(),
			`${Array.from({ length: 501 }, (_, i) => JSON.stringify(rec(`s${i}`))).join("\n")}\n`,
		);
		await session.syncPending();

		expect(peak).toBe(2);
	});

	test("syncPending: nothing pending means no request", async () => {
		const session = cloudSession();
		writeFileSync(
			join(cwd, ".hashtrack", "synced.jsonl"),
			`${JSON.stringify(rec("done"))}\n`,
		);
		await session.syncPending();
		expect(calls).toHaveLength(0);
	});

	test("syncPending: non-2xx keeps records in usage.jsonl", async () => {
		globalThis.fetch = ((url: string, init?: RequestInit) => {
			calls.push({ url, init });
			return Promise.resolve(new Response("nope", { status: 500 }));
		}) as typeof fetch;
		const session = cloudSession();
		writeFileSync(hashtrackFile(), `${JSON.stringify(rec("pending"))}\n`);
		await session.syncPending();
		expect(calls).toHaveLength(1);
		expect(stored("usage.jsonl")[0]?.sid).toBe("pending");
	});
});

describe("storage path", () => {
	test("writes into .hashtrack under the git root", () => {
		const session = new Session({ sessionId: "s1", harness: "pi" });
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(1, 0) });
		session.flush();
		expect(readFileSync(hashtrackFile(), "utf8")).toContain('"sid":"s1"');
	});

	test("cwd overrides process.cwd() for the repo", async () => {
		const other = mkdtempSync(join(tmpdir(), "hashtrack-other-"));
		try {
			const session = new Session({
				sessionId: "s2",
				harness: "pi",
				cwd: other,
			});
			session.startAgent({ dateTimeISOString: "t", model: "m" });
			session.addTurn({ tools: [], totalUsage: usage(1, 0) });
			await session.flush();
			expect(
				readFileSync(join(other, ".hashtrack", "usage.jsonl"), "utf8"),
			).toContain('"sid":"s2"');
			expect(existsSync(join(cwd, ".hashtrack", "usage.jsonl"))).toBe(false);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});
});

describe("renamed storage directory", () => {
	test("moves a legacy .witness directory on first write", () => {
		mkdirSync(join(cwd, ".witness"), { recursive: true });
		writeFileSync(
			join(cwd, ".witness", "usage.jsonl"),
			`${JSON.stringify(rec("legacy"))}\n`,
		);

		const session = new Session({ sessionId: "s1", harness: "pi" });

		expect(session.totalTokens).toBe(1); // history loaded after the move
		expect(existsSync(join(cwd, ".witness"))).toBe(false);
		expect(
			readFileSync(join(cwd, ".hashtrack", "usage.jsonl"), "utf8"),
		).toContain('"sid":"legacy"');
	});

	test("readers fall back to .witness before any adapter writes", () => {
		mkdirSync(join(cwd, ".witness"), { recursive: true });
		writeFileSync(
			join(cwd, ".witness", "usage.jsonl"),
			`${JSON.stringify(rec("legacy"))}\n`,
		);

		expect(readRepoRecords(cwd).map((r) => r.sid)).toEqual(["legacy"]);
		expect(existsSync(join(cwd, ".hashtrack"))).toBe(false);
	});

	test("HASHTRACK_DIR overrides the directory name", async () => {
		process.env.HASHTRACK_DIR = ".custom";
		try {
			const session = new Session({ sessionId: "s1", harness: "pi" });
			session.startAgent({ dateTimeISOString: "t", model: "m" });
			session.addTurn({ tools: [], totalUsage: usage(1, 0) });
			await session.flush();
			expect(
				readFileSync(join(cwd, ".custom", "usage.jsonl"), "utf8"),
			).toContain('"sid":"s1"');
			expect(existsSync(join(cwd, ".hashtrack"))).toBe(false);
		} finally {
			delete process.env.HASHTRACK_DIR;
		}
	});
});
