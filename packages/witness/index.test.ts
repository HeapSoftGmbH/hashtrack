import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentTurnRecord, Session, type Usage } from "./index";

const usage = (tok: number, cst: number): Usage => ({
	in: 0,
	out: 0,
	cw: 0,
	cr: 0,
	tok,
	reason: 0,
	cst,
});

const witnessFile = () => join(cwd, ".witness", "usage.jsonl");

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
	cwd = mkdtempSync(join(tmpdir(), "witness-cwd-"));
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
		mkdirSync(join(cwd, ".witness"), { recursive: true });
		writeFileSync(
			witnessFile(),
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

		const lines = readFileSync(witnessFile(), "utf8").trim().split("\n");
		expect(lines).toHaveLength(2);
		const rec = JSON.parse(lines[1] ?? "") as AgentTurnRecord;
		expect(rec.turns).toHaveLength(1);
		expect(rec.mod).toBe("m1"); // model remembered from last startAgent
		expect(session.totalCost).toBeCloseTo(0.3);
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

		const lines = readFileSync(witnessFile(), "utf8").trim().split("\n");
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
		const lines = readFileSync(witnessFile(), "utf8").trim().split("\n");
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
		mkdirSync(join(cwd, ".witness"), { recursive: true });
		writeFileSync(witnessFile(), `${JSON.stringify(old)}\n`);

		const session = new Session({ sessionId: "s2", harness: "pi" });
		session.startAgent({
			dateTimeISOString: "2026-01-02T00:00:00Z",
			model: "m",
		});
		session.addTurn({ tools: [], totalUsage: usage(1, 0.01) });
		session.flush();

		expect(session.totalTokens).toBe(101);
		expect(readFileSync(witnessFile(), "utf8").trim().split("\n")).toHaveLength(
			2,
		);
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
		readFileSync(join(cwd, ".witness", file), "utf8")
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
		expect(readFileSync(witnessFile(), "utf8")).toContain('"sid":"s1"');
		expect(() => stored("synced.jsonl")).toThrow(); // never created
	});

	test("syncPending batches usage.jsonl, archives it, keeps malformed lines", async () => {
		const session = cloudSession();
		const one = rec("one");
		const two = rec("two");
		writeFileSync(
			witnessFile(),
			`${JSON.stringify(one)}\nnot json\n${JSON.stringify(two)}\n`,
		);

		await session.syncPending();

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://api.example.com/api/ingest");
		expect(sent(0).records.map((r) => r.sid)).toEqual(["one", "two"]);
		expect(readFileSync(witnessFile(), "utf8")).toBe("not json\n");
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
		writeFileSync(witnessFile(), `${lines.join("\n")}\n`);

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
			witnessFile(),
			`${Array.from({ length: 501 }, (_, i) => JSON.stringify(rec(`s${i}`))).join("\n")}\n`,
		);
		await session.syncPending();

		expect(peak).toBe(2);
	});

	test("syncPending: nothing pending means no request", async () => {
		const session = cloudSession();
		writeFileSync(
			join(cwd, ".witness", "synced.jsonl"),
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
		writeFileSync(witnessFile(), `${JSON.stringify(rec("pending"))}\n`);
		await session.syncPending();
		expect(calls).toHaveLength(1);
		expect(stored("usage.jsonl")[0]?.sid).toBe("pending");
	});
});

describe("storage path", () => {
	test("writes into .witness under the git root", () => {
		const session = new Session({ sessionId: "s1", harness: "pi" });
		session.startAgent({ dateTimeISOString: "t", model: "m" });
		session.addTurn({ tools: [], totalUsage: usage(1, 0) });
		session.flush();
		expect(readFileSync(witnessFile(), "utf8")).toContain('"sid":"s1"');
	});
});
