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
import type { AgentTurnRecord } from "witness";
import plugin from "./index";

interface FakeEvent {
	type: string;
	created: number;
	location?: { directory: string };
	data: Record<string, unknown>;
}

function eventStream() {
	const queue: FakeEvent[] = [];
	let waiting: ((result: IteratorResult<FakeEvent>) => void) | undefined;
	let closed = false;

	const close = () => {
		closed = true;
		waiting?.({ value: undefined, done: true });
		waiting = undefined;
	};

	return {
		push(event: FakeEvent) {
			if (waiting) {
				const resolve = waiting;
				waiting = undefined;
				resolve({ value: event, done: false });
			} else {
				queue.push(event);
			}
		},
		close,
		subscribe({ signal }: { signal?: AbortSignal } = {}) {
			signal?.addEventListener("abort", close);
			return {
				async *[Symbol.asyncIterator]() {
					while (!closed) {
						const next = queue.shift();
						if (next) {
							yield next;
							continue;
						}
						const result = await new Promise<IteratorResult<FakeEvent>>(
							(resolve) => {
								waiting = resolve;
							},
						);
						if (result.done) return;
						yield result.value;
					}
				},
			};
		},
	};
}

const tokens = (over: Record<string, unknown> = {}) => ({
	input: 100,
	output: 50,
	reasoning: 7,
	cache: { read: 10, write: 5 },
	...over,
});

const model = (over: Record<string, unknown> = {}) => ({
	providerID: "anthropic",
	id: "claude",
	...over,
});

const record = (dir: string, file = "usage.jsonl"): AgentTurnRecord[] => {
	let raw: string;
	try {
		raw = readFileSync(join(dir, ".witness", file), "utf8").trim();
	} catch {
		return [];
	}
	return raw
		? raw.split("\n").map((line) => JSON.parse(line) as AgentTurnRecord)
		: [];
};

let cwd: string;
let prevXdg: string | undefined;
let stream: ReturnType<typeof eventStream>;
let cleanup: Awaited<ReturnType<typeof plugin.setup>>;

const start = async (directory = cwd) => {
	stream = eventStream();
	cleanup = await plugin.setup({
		location: {
			directory,
			project: { id: "prj-1", directory, canonical: directory },
		},
		event: { subscribe: stream.subscribe },
		rpc: {
			register: async () => ({
				events: { emit: async () => {} },
				dispose: async () => {},
			}),
		},
	} as never);
};

const emit = async (
	type: string,
	data: Record<string, unknown>,
	location?: { directory: string },
) => {
	stream.push({
		type,
		created: 0,
		data,
		...(location ? { location } : {}),
	});
	// let the subscription loop drain
	await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "witness-opencode-cwd-"));
	// keep the developer's real ~/.config/opencode/witness/config.json out of the tests:
	// with it in place every flush would upload fixture records to the production endpoint
	prevXdg = process.env.XDG_CONFIG_HOME;
	process.env.XDG_CONFIG_HOME = join(cwd, "xdg");
});

afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
	if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
	else process.env.XDG_CONFIG_HOME = prevXdg;
	rmSync(cwd, { recursive: true, force: true });
});

describe("witness-opencode adapter", () => {
	test("full lifecycle: session, skills, tools, turn, idle flush", async () => {
		await start();

		await emit("session.created", {
			sessionID: "ses-1",
			title: "my session",
			version: "2.2.1",
			model: model(),
		});
		await emit("session.skill.activated", {
			sessionID: "ses-1",
			id: "skill-1",
			name: "ponytail",
			text: "",
		});
		await emit("session.tool.input.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			id: "call-1",
			name: "bash",
		});
		await emit("session.tool.input.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			id: "call-2",
			name: "read",
		});
		// a tool that never finishes is not recorded
		await emit("session.tool.input.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			id: "call-3",
			name: "grep",
		});
		await emit("session.tool.success", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			id: "call-1",
			content: [],
			executed: true,
		});
		await emit("session.tool.failed", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			id: "call-2",
			error: { type: "unknown", message: "boom" },
			executed: true,
		});
		await emit("session.step.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			agent: "build",
			model: model(),
			started: 1_000,
		});
		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			finish: "stop",
			cost: 0.1,
			tokens: tokens(),
		});
		await emit("session.idle", { sessionID: "ses-1" });

		const recs = record(cwd);
		expect(recs).toHaveLength(1);
		const rec = recs[0];
		if (!rec) throw new Error("no record");
		expect(rec.sid).toBe("ses-1");
		expect(rec.sn).toBe("my session");
		expect(rec.h).toBe("opencode");
		expect(rec.hv).toBe("2.2.1");
		expect(rec.mod).toBe("anthropic/claude");
		expect(rec.t).toBe(new Date(1_000).toISOString());
		expect(rec.skills).toEqual(["ponytail"]);

		expect(rec.turns).toHaveLength(1);
		const turn = rec.turns?.[0];
		expect(turn?.ti).toBe(0);
		expect(turn?.tools).toEqual([
			{ name: "bash", isError: false },
			{ name: "read", isError: true },
		]);
		expect(turn?.totalUsage).toEqual({
			in: 100,
			out: 50,
			cw: 5,
			cr: 10,
			tok: 172,
			reason: 7,
			cst: 0.1,
		});
	});

	test("turns accumulate per run; duplicate steps ignored", async () => {
		await start();

		await emit("session.step.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			agent: "build",
			model: model(),
			started: 1_000,
		});
		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			finish: "stop",
			cost: 0.1,
			tokens: tokens(),
		});
		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			finish: "stop",
			cost: 0.1,
			tokens: tokens(),
		});
		// a failed step still consumed tokens
		await emit("session.step.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-2",
			agent: "build",
			model: model(),
			started: 2_000,
		});
		await emit("session.step.failed", {
			sessionID: "ses-1",
			assistantMessageID: "msg-2",
			error: { type: "unknown", message: "boom" },
			cost: 0.2,
			tokens: tokens({ input: 10 }),
		});
		await emit("session.idle", { sessionID: "ses-1" });

		// a second run after idle starts a new record with a fresh turn index
		await emit("session.execution.started", { sessionID: "ses-1" });
		await emit("session.step.started", {
			sessionID: "ses-1",
			assistantMessageID: "msg-3",
			agent: "build",
			model: model({ id: "gpt" }),
			started: 3_000,
		});
		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-3",
			finish: "stop",
			cost: 0.3,
			tokens: tokens(),
		});
		await emit("session.idle", { sessionID: "ses-1" });

		const recs = record(cwd);
		expect(recs).toHaveLength(2);
		expect(recs[0]?.turns?.map((t) => t.ti)).toEqual([0, 1]);
		expect(recs[1]?.turns?.map((t) => t.ti)).toEqual([0]);
		// model is fixed by the first step of each run
		expect(recs[0]?.mod).toBe("anthropic/claude");
		expect(recs[1]?.mod).toBe("anthropic/gpt");
		expect(recs[0]?.turns?.[1]?.totalUsage.cst).toBe(0.2);
	});

	test("cleanup flushes; unknown session idle is ignored", async () => {
		await start();

		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			finish: "stop",
			cost: 0.1,
			tokens: tokens(),
		});
		await emit("session.idle", { sessionID: "ses-other" });
		expect(record(cwd)).toHaveLength(0);

		await cleanup?.();
		cleanup = undefined;
		expect(record(cwd)).toHaveLength(1);
	});

	test("session name survives switching to another session and back", async () => {
		await start();

		await emit("session.created", {
			sessionID: "ses-1",
			title: "parent",
			version: "2.2.1",
			model: model(),
		});
		await emit("session.created", {
			sessionID: "ses-2",
			title: "child",
			version: "2.2.1",
			model: model(),
		});
		// back to the parent: no second session.created, the title must be remembered
		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			finish: "stop",
			cost: 0.1,
			tokens: tokens(),
		});
		await emit("session.idle", { sessionID: "ses-1" });

		const recs = record(cwd);
		expect(recs).toHaveLength(1);
		expect(recs[0]?.sid).toBe("ses-1");
		expect(recs[0]?.sn).toBe("parent");
	});

	test("falls back to the session slug until a title exists", async () => {
		await start();

		await emit("session.created", {
			sessionID: "ses-1",
			slug: "bright-orbit",
			version: "2.2.1",
		});
		await emit("session.step.ended", {
			sessionID: "ses-1",
			assistantMessageID: "msg-1",
			finish: "stop",
			cost: 0.1,
			tokens: tokens(),
		});
		await emit("session.idle", { sessionID: "ses-1" });

		const recs = record(cwd);
		expect(recs[0]?.sn).toBe("bright-orbit");
	});

	test("interleaved sessions keep their own run and turn index", async () => {
		await start();

		await emit("session.created", {
			sessionID: "ses-a",
			title: "a",
			version: "2.2.1",
			model: model(),
		});
		await emit("session.created", {
			sessionID: "ses-b",
			title: "b",
			version: "2.2.1",
			model: model(),
		});

		const step = async (sessionID: string, assistantMessageID: string) => {
			await emit("session.step.started", {
				sessionID,
				assistantMessageID,
				agent: "build",
				model: model(),
				started: 1_000,
			});
			await emit("session.step.ended", {
				sessionID,
				assistantMessageID,
				finish: "stop",
				cost: 0.1,
				tokens: tokens(),
			});
		};

		await step("ses-a", "msg-a1");
		await step("ses-b", "msg-b1");
		await step("ses-a", "msg-a2");
		await step("ses-b", "msg-b2");
		await emit("session.idle", { sessionID: "ses-a" });
		await emit("session.idle", { sessionID: "ses-b" });

		const recs = record(cwd);
		expect(recs).toHaveLength(2);
		const a = recs.find((rec) => rec.sid === "ses-a");
		const b = recs.find((rec) => rec.sid === "ses-b");
		expect(a?.turns?.map((turn) => turn.ti)).toEqual([0, 1]);
		expect(b?.turns?.map((turn) => turn.ti)).toEqual([0, 1]);
	});

	test("session title survives idle into the next run", async () => {
		await start();

		await emit("session.created", {
			sessionID: "ses-1",
			title: "kept",
			version: "2.2.1",
			model: model(),
		});

		const step = async (assistantMessageID: string) => {
			await emit("session.step.started", {
				sessionID: "ses-1",
				assistantMessageID,
				agent: "build",
				model: model(),
				started: 1_000,
			});
			await emit("session.step.ended", {
				sessionID: "ses-1",
				assistantMessageID,
				finish: "stop",
				cost: 0.1,
				tokens: tokens(),
			});
		};

		await step("msg-1");
		await emit("session.idle", { sessionID: "ses-1" });
		await emit("session.execution.started", { sessionID: "ses-1" });
		await step("msg-2");
		await emit("session.idle", { sessionID: "ses-1" });

		const recs = record(cwd);
		expect(recs.map((rec) => rec.sn)).toEqual(["kept", "kept"]);
	});

	test("ignores sessions from another location", async () => {
		const other = mkdtempSync(join(tmpdir(), "witness-opencode-other-"));
		try {
			await start();

			await emit("session.created", {
				sessionID: "ses-other",
				title: "other",
				version: "2.2.1",
				model: model(),
				location: { directory: other },
			});
			await emit(
				"session.step.started",
				{
					sessionID: "ses-other",
					assistantMessageID: "msg-1",
					agent: "build",
					model: model(),
					started: 1_000,
				},
				{ directory: other },
			);
			await emit(
				"session.step.ended",
				{
					sessionID: "ses-other",
					assistantMessageID: "msg-1",
					finish: "stop",
					cost: 0.1,
					tokens: tokens(),
				},
				{ directory: other },
			);
			await emit(
				"session.idle",
				{ sessionID: "ses-other" },
				{
					directory: other,
				},
			);

			expect(record(cwd)).toHaveLength(0);
			expect(existsSync(join(other, ".witness"))).toBe(false);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});

	test("flushes and stops recording when a session moves to another location", async () => {
		const other = mkdtempSync(join(tmpdir(), "witness-opencode-other-"));
		try {
			await start();

			await emit("session.created", {
				sessionID: "ses-1",
				title: "moved",
				version: "2.2.1",
				model: model(),
			});
			await emit("session.step.started", {
				sessionID: "ses-1",
				assistantMessageID: "msg-1",
				agent: "build",
				model: model(),
				started: 1_000,
			});
			await emit("session.step.ended", {
				sessionID: "ses-1",
				assistantMessageID: "msg-1",
				finish: "stop",
				cost: 0.1,
				tokens: tokens(),
			});
			await emit("session.moved", {
				sessionID: "ses-1",
				location: { directory: other },
				projectID: "prj-1",
			});
			// events after the move belong to the destination instance
			await emit(
				"session.step.started",
				{
					sessionID: "ses-1",
					assistantMessageID: "msg-2",
					agent: "build",
					model: model(),
					started: 2_000,
				},
				{ directory: other },
			);
			await emit(
				"session.step.ended",
				{
					sessionID: "ses-1",
					assistantMessageID: "msg-2",
					finish: "stop",
					cost: 0.1,
					tokens: tokens(),
				},
				{ directory: other },
			);

			const recs = record(cwd);
			expect(recs).toHaveLength(1);
			expect(recs[0]?.turns).toHaveLength(1);
			expect(existsSync(join(other, ".witness"))).toBe(false);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});

	test("cloud config under XDG_CONFIG_HOME uploads to the default API base", async () => {
		const dir = join(cwd, "xdg", "opencode", "witness");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "config.json"), JSON.stringify({ token: "tok" }));

		const calls: string[] = [];
		const original = globalThis.fetch;
		globalThis.fetch = (async (
			input: Parameters<typeof fetch>[0],
			init?: Parameters<typeof fetch>[1],
		) => {
			calls.push(
				`${String(input)}|${new Headers(init?.headers).get("authorization")}`,
			);
			return new Response("{}", { status: 200 });
		}) as typeof fetch;

		try {
			await start();
			await emit("session.step.ended", {
				sessionID: "ses-1",
				assistantMessageID: "msg-1",
				finish: "stop",
				cost: 0.1,
				tokens: tokens(),
			});
			await emit("session.idle", { sessionID: "ses-1" });
		} finally {
			globalThis.fetch = original;
		}

		expect(calls).toEqual([
			"https://witness-rho-rust.vercel.app/api/ingest|Bearer tok",
		]);
		// an uploaded record is archived, so usage.jsonl is empty
		expect(record(cwd)).toHaveLength(0);
		expect(record(cwd, "synced.jsonl")).toHaveLength(1);
	});

	test("records land in the plugin's location, not process.cwd()", async () => {
		const other = mkdtempSync(join(tmpdir(), "witness-opencode-other-"));
		try {
			await start(other);
			await emit("session.step.ended", {
				sessionID: "ses-1",
				assistantMessageID: "msg-1",
				finish: "stop",
				cost: 0.1,
				tokens: tokens(),
			});
			await emit("session.idle", { sessionID: "ses-1" });

			const written = readFileSync(
				join(other, ".witness", "usage.jsonl"),
				"utf8",
			);
			expect(written).toContain('"sid":"ses-1"');
			expect(record(cwd)).toHaveLength(0);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});
});
