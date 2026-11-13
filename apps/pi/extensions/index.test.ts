import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentTurnRecord } from "@hashtrack/core";
import { hashtrackColorRgb, hashtrackMark } from "@hashtrack/lib";
import main from "./index";

type FakeCtx = {
	sessionManager: { getSessionId: () => string };
	model?: { provider: string; name: string };
	ui: {
		setStatus: (id: string, text: string) => void;
		theme: {
			fg: (style: string, text: string) => string;
			style: (text: string, options: unknown) => string;
		};
	};
};

type PiEvent = Record<string, unknown>;
type Handler = (event: PiEvent | undefined, ctx: FakeCtx) => unknown;

function setup(model?: { provider: string; name: string }) {
	const handlers = new Map<string, Handler>();
	const status: string[] = [];
	const styles: unknown[] = [];
	const ctx: FakeCtx = {
		sessionManager: { getSessionId: () => "sess-1" },
		model,
		ui: {
			setStatus: (id, text) => status.push(`${id}:${text}`),
			theme: {
				fg: (_style, text) => text,
				style: (text, options) => {
					styles.push(options);
					return text;
				},
			},
		},
	};
	const pi = {
		on: (name: string, h: Handler) => void handlers.set(name, h),
		registerCommand: () => {},
	};
	main(pi as unknown as ExtensionAPI);
	const emit = (
		name: string,
		event?: PiEvent,
		ctxOverride?: FakeCtx,
	): Promise<unknown> =>
		Promise.resolve(handlers.get(name)?.(event, ctxOverride ?? ctx));
	return { status, emit, ctx, styles };
}

const record = (file = "usage.jsonl"): AgentTurnRecord[] => {
	const raw = readFileSync(join(cwd, ".hashtrack", file), "utf8").trim();
	return raw
		? raw.split("\n").map((l) => JSON.parse(l) as AgentTurnRecord)
		: [];
};

let cwd: string;
let prevCwd: string;
let prevAgentDir: string | undefined;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "hashtrack-pi-cwd-"));
	prevCwd = process.cwd();
	process.chdir(cwd);
	cwd = process.cwd();
	prevAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = join(cwd, "agent");
});

afterEach(() => {
	if (prevAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = prevAgentDir;
	process.chdir(prevCwd);
	rmSync(cwd, { recursive: true, force: true });
});

describe("pi adapter", () => {
	test("full lifecycle: start, rename, turn, settle", async () => {
		const { status, emit, styles } = setup({
			provider: "anthropic",
			name: "claude",
		});

		await emit("session_start", { reason: "user" });
		expect(status[0]).toBe(`hashtrack:${hashtrackMark} 0 · $0.00`);
		expect(styles.at(-1)).toEqual({
			fg: { kind: "rgb", ...hashtrackColorRgb },
		});

		await emit("session_info_changed", { name: "renamed" });
		await emit("agent_start", {});
		await emit("turn_end", {
			turnIndex: 2,
			toolResults: [
				{
					toolName: "read",
					isError: false,
					usage: {
						input: 10,
						output: 5,
						totalTokens: 15,
						cost: { total: 0.02 },
					},
				},
				{ toolName: "bash", isError: true, usage: undefined },
			],
			message: {
				role: "assistant",
				usage: {
					input: 100,
					output: 50,
					totalTokens: 150,
					reasoning: 7,
					cost: { total: 0.1 },
				},
			},
		});
		await emit("agent_settled");

		expect(status.at(-1)).toBe(`hashtrack:${hashtrackMark} 165 · $0.12`);
		const recs = record();
		expect(recs).toHaveLength(1);
		const rec = recs[0];
		if (!rec) throw new Error("no record");
		expect(rec.sid).toBe("sess-1");
		expect(rec.sn).toBe("renamed");
		expect(rec.h).toBe("pi");
		expect(rec.mod).toBe("anthropic/claude");
		expect(rec.metadata).toEqual({ start_reason: "user" });
		const turn = rec.turns?.[0];
		if (!turn) throw new Error("no turn");
		expect(turn.ti).toBe(2);
		expect(turn.tools).toHaveLength(2);
		expect(turn.tools?.[0]?.name).toBe("read");
		expect(turn.tools?.[0]?.isError).toBe(false);
		expect(turn.tools?.[0]?.usage).toEqual({
			in: 10,
			out: 5,
			cw: 0,
			cr: 0,
			tok: 15,
			reason: 0,
			cst: 0.02,
		});
		expect(turn.tools?.[1]?.usage).toEqual({
			in: 0,
			out: 0,
			cw: 0,
			cr: 0,
			tok: 0,
			reason: 0,
			cst: 0,
		});
		// assistant + both tools summed
		expect(turn.totalUsage).toEqual({
			in: 110,
			out: 55,
			cw: 0,
			cr: 0,
			tok: 165,
			reason: 7,
			cst: 0.12000000000000001,
		});
	});

	test("agent_start model: ctx override wins, empty fallback", async () => {
		const { emit } = setup();

		await emit("session_start", { reason: "user" });
		await emit(
			"agent_start",
			{},
			{
				sessionManager: { getSessionId: () => "sess-1" },
				model: { provider: "openai", name: "gpt" },
				ui: {
					setStatus: () => {},
					theme: { fg: (_s: string, t: string) => t },
				},
			},
		);
		await emit("agent_settled");

		await emit("session_start", { reason: "user" });
		await emit("agent_start", {}); // no model anywhere → ""
		await emit("agent_settled");

		const recs = record();
		expect(recs[0]?.mod).toBe("openai/gpt");
		expect(recs[1]?.mod).toBe("");
	});

	test("session_shutdown flushes; empty turn_end is zero-usage", async () => {
		const { emit } = setup();

		await emit("session_start", { reason: "user" });
		await emit("agent_start", {});
		await emit("turn_end", {}); // no tools, no message
		await emit("session_shutdown");

		const turn = record()[0]?.turns?.[0];
		expect(turn?.ti).toBe(0); // missing turnIndex → 0
		expect(turn?.totalUsage).toEqual({
			in: 0,
			out: 0,
			cw: 0,
			cr: 0,
			tok: 0,
			reason: 0,
			cst: 0,
		});
	});

	// Config lives at <pi root>/hashtrack/config.json, i.e. ~/.pi/hashtrack/config.json.
	const cloudConfig = (config?: object) => {
		const root = mkdtempSync(join(tmpdir(), "hashtrack-pi-root-"));
		const agentDir = join(root, "agent");
		mkdirSync(agentDir, { recursive: true });
		if (config) {
			mkdirSync(join(root, "hashtrack"), { recursive: true });
			writeFileSync(
				join(root, "hashtrack", "config.json"),
				JSON.stringify(config),
			);
		}
		process.env.PI_CODING_AGENT_DIR = agentDir;
		return () => {
			rmSync(root, { recursive: true, force: true });
		};
	};

	test("cloud config from ~/.pi/hashtrack/config.json is uploaded on settle", async () => {
		const cleanup = cloudConfig({
			url: "https://api.example.com",
			token: "t",
		});
		const calls: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((url: string) => {
			calls.push(url);
			return Promise.resolve(new Response("{}"));
		}) as typeof fetch;
		try {
			const { emit } = setup();
			await emit("session_start", { reason: "user" });
			await emit("agent_start", {});
			await emit("turn_end", {});
			await emit("agent_settled");
			expect(calls).toEqual(["https://api.example.com/api/ingest"]);
		} finally {
			globalThis.fetch = originalFetch;
			cleanup();
		}
	});

	test("the token file is tightened to owner-only on read", async () => {
		const cleanup = cloudConfig({ token: "t" });
		const file = join(
			dirname(process.env.PI_CODING_AGENT_DIR ?? ""),
			"hashtrack",
			"config.json",
		);
		chmodSync(file, 0o644); // start world-readable, as a plain create would
		try {
			const { emit } = setup();
			await emit("session_start", { reason: "user" });
			expect(statSync(file).mode & 0o777).toBe(0o600);
		} finally {
			cleanup();
		}
	});

	test("token-only config falls back to the default API base", async () => {
		const cleanup = cloudConfig({ token: "t" });
		const calls: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((url: string) => {
			calls.push(url);
			return Promise.resolve(new Response("{}"));
		}) as typeof fetch;
		try {
			const { emit } = setup();
			await emit("session_start", { reason: "user" });
			await emit("agent_start", {});
			await emit("turn_end", {});
			await emit("agent_settled");
			expect(calls).toEqual(["https://www.hashtrack.ai/api/ingest"]);
		} finally {
			globalThis.fetch = originalFetch;
			cleanup();
		}
	});

	test("startup syncs unsynced records in one batch", async () => {
		const cleanup = cloudConfig({
			url: "https://api.example.com",
			token: "t",
		});
		mkdirSync(join(cwd, ".hashtrack"), { recursive: true });
		writeFileSync(
			join(cwd, ".hashtrack", "usage.jsonl"),
			`${JSON.stringify({ t: "t", sid: "old", sn: "", h: "pi", mod: "m", rep: cwd, turns: [] })}\n`,
		);
		const bodies: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((_url: string, init?: RequestInit) => {
			bodies.push(String(init?.body));
			return Promise.resolve(new Response("{}"));
		}) as typeof fetch;
		try {
			const { emit } = setup();
			await emit("session_start", { reason: "user" });
			expect(bodies).toHaveLength(1);
			expect(
				(JSON.parse(bodies[0] ?? "") as { records: { sid: string }[] }).records,
			).toHaveLength(1);
			expect(record()).toHaveLength(0); // moved out of usage.jsonl
			expect(record("synced.jsonl")[0]?.sid).toBe("old");
		} finally {
			globalThis.fetch = originalFetch;
			cleanup();
		}
	});

	test("no config file: local only, no upload", async () => {
		const cleanup = cloudConfig();
		const calls: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = ((url: string) => {
			calls.push(url);
			return Promise.resolve(new Response("{}"));
		}) as typeof fetch;
		try {
			const { emit } = setup();
			await emit("session_start", { reason: "user" });
			await emit("agent_start", {});
			await emit("turn_end", {});
			await emit("agent_settled");
			expect(calls).toEqual([]);
			expect(record()).toHaveLength(1);
		} finally {
			globalThis.fetch = originalFetch;
			cleanup();
		}
	});

	test("status formats k and M tokens", async () => {
		const { status, emit } = setup();

		await emit("session_start", { reason: "user" });
		await emit("agent_start", {});
		await emit("turn_end", {
			message: { role: "assistant", usage: { totalTokens: 1500 } },
		});
		expect(status.at(-1)).toBe(`hashtrack:${hashtrackMark} 1.5K · $0.00`);

		await emit("turn_end", {
			message: { role: "assistant", usage: { totalTokens: 1500000 } },
		});
		expect(status.at(-1)).toBe(`hashtrack:${hashtrackMark} 1.5M · $0.00`);
	});

	describe("skill tracking", () => {
		test("user-typed /skill:<name> input", async () => {
			const { emit } = setup();

			await emit("session_start", { reason: "user" });
			await emit("input", { text: "/skill:ponytail" });
			await emit("input", { text: "/skill:shadcn-svelte add card please" }); // name + args
			await emit("input", { text: "just a normal prompt" });
			await emit("agent_start", {});
			await emit("agent_settled");

			expect(record()[0]?.skills).toEqual(["ponytail", "shadcn-svelte"]);
		});

		test("agent reads SKILL.md via read tool", async () => {
			const { emit } = setup();

			await emit("session_start", { reason: "user" });
			await emit("tool_call", {
				type: "tool_call",
				toolCallId: "c1",
				toolName: "read",
				input: { path: "/Users/x/.agents/skills/tauri/SKILL.md" },
			});
			await emit("tool_call", {
				type: "tool_call",
				toolCallId: "c2",
				toolName: "read",
				input: { path: "SKILL.md" },
			});
			await emit("tool_call", {
				type: "tool_call",
				toolCallId: "c3",
				toolName: "read",
				input: { path: "/Users/x/notes/SKILL.md.bak" },
			});
			await emit("tool_call", {
				type: "tool_call",
				toolCallId: "c4",
				toolName: "bash",
				input: { command: "cat SKILL.md" },
			});
			await emit("agent_start", {});
			await emit("agent_settled");

			expect(record()[0]?.skills).toEqual(["tauri", "skill:unknown"]);
		});

		test("both paths accumulate into one record", async () => {
			const { emit } = setup();

			await emit("session_start", { reason: "user" });
			await emit("input", { text: "/skill:ponytail" });
			await emit("tool_call", {
				type: "tool_call",
				toolCallId: "c1",
				toolName: "read",
				input: { path: "/skills/svelte-code-writer/SKILL.md" },
			});
			await emit("agent_start", {});
			await emit("agent_settled");

			expect(record()[0]?.skills).toEqual(["ponytail", "svelte-code-writer"]);
		});
	});
});
