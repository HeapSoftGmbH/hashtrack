import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTurnRecord } from "@hashtrack/core";
import { assistant, jsonl, prompt, toolResult, toolUse } from "./fixtures";
import { runHook } from "./hook";

let dir: string;
const env = { ...process.env };

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "hashtrack-claude-"));
	process.env.HASHTRACK_DIR = join(dir, "data");
	process.env.CLAUDE_PLUGIN_DATA = join(dir, "plugin");
	process.env.CLAUDE_CONFIG_DIR = join(dir, "config");
});

afterEach(() => {
	process.env = { ...env };
	rmSync(dir, { recursive: true, force: true });
});

function records(): AgentTurnRecord[] {
	try {
		return readFileSync(join(dir, "data", "usage.jsonl"), "utf8")
			.trim()
			.split("\n")
			.map((l) => JSON.parse(l));
	} catch {
		return [];
	}
}

describe("runHook", () => {
	test("stop records each burst once", async () => {
		const transcript = join(dir, "session.jsonl");
		const lines = [
			prompt("go"),
			...assistant("m1", [toolUse("t1", "Read")]),
			toolResult("t1"),
			...assistant("m2", [{ type: "text" }]),
			{ type: "custom-title", customTitle: "my session" },
		];
		writeFileSync(transcript, jsonl(lines));
		const input = { session_id: "s1", transcript_path: transcript, cwd: dir };

		await runHook("stop", input);
		await runHook("stop", input);
		expect(records()).toHaveLength(1);

		const [rec] = records();
		expect(rec).toMatchObject({
			sid: "s1",
			sn: "my session",
			h: "claude",
			hv: "2.1.321",
			mod: "anthropic/claude-opus-5-5",
			rep: dir,
		});
		expect(rec?.turns.map((t) => t.ti)).toEqual([0, 1]);

		writeFileSync(
			transcript,
			jsonl([
				...lines,
				prompt("again"),
				...assistant("m3", [{ type: "text" }]),
			]),
		);
		await runHook("stop", input);
		expect(records()).toHaveLength(2);
		expect(records()[1]?.turns).toHaveLength(1);
	});

	test("end picks up a burst Stop never saw", async () => {
		const transcript = join(dir, "session.jsonl");
		writeFileSync(
			transcript,
			jsonl([prompt("go"), ...assistant("m1", [{ type: "text" }])]),
		);
		await runHook("end", {
			session_id: "s1",
			transcript_path: transcript,
			cwd: dir,
		});
		expect(records()).toHaveLength(1);
	});

	describe("the cursor lock", () => {
		function setup() {
			const transcript = join(dir, "session.jsonl");
			writeFileSync(
				transcript,
				jsonl([prompt("go"), ...assistant("m1", [{ type: "text" }])]),
			);
			const lock = join(dir, "plugin", "cursors", "s1.json.lock");
			mkdirSync(join(lock, ".."), { recursive: true });
			writeFileSync(lock, "");
			const input = { session_id: "s1", transcript_path: transcript, cwd: dir };
			return { input, lock };
		}

		test("a hook waits for the lock, so Stop and SessionEnd record a burst once", async () => {
			const { input, lock } = setup();

			const end = runHook("end", input);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(records()).toHaveLength(0);

			rmSync(lock);
			await end;
			await runHook("stop", input);

			expect(records()).toHaveLength(1);
			expect(existsSync(lock)).toBe(false);
			// cursors are written via tmp + rename, and nothing is left behind
			expect(readdirSync(join(lock, ".."))).toEqual(["s1.json"]);
		});

		test("a lock that never got a pid is taken over once it is old", async () => {
			const { input, lock } = setup();
			const old = new Date(Date.now() - 60_000);
			utimesSync(lock, old, old);

			await runHook("stop", input);

			expect(records()).toHaveLength(1);
			expect(existsSync(lock)).toBe(false);
		});

		test("a lock whose holder exited is taken over", async () => {
			const { input, lock } = setup();
			writeFileSync(lock, String(Bun.spawnSync(["true"]).pid));

			await runHook("stop", input);

			expect(records()).toHaveLength(1);
			expect(existsSync(lock)).toBe(false);
		});

		test("a lock whose holder is alive is waited on, however old", async () => {
			const { input, lock } = setup();
			writeFileSync(lock, String(process.pid));
			const old = new Date(Date.now() - 30_000);
			utimesSync(lock, old, old);

			await runHook("stop", input);

			expect(records()).toHaveLength(0);
		});

		test("a lock that stays held records nothing: its holder records the burst", async () => {
			const { input, lock } = setup();

			expect(await runHook("stop", input)).toEqual({ upload: false });

			expect(records()).toHaveLength(0);
			expect(existsSync(lock)).toBe(true);
		});
	});

	test("subagent-stop records the subagent transcript with its agent type", async () => {
		const main = join(dir, "session.jsonl");
		const sub = join(dir, "agent.jsonl");
		writeFileSync(
			main,
			jsonl([{ type: "custom-title", customTitle: "parent" }]),
		);
		writeFileSync(
			sub,
			jsonl([
				prompt("explore"),
				...assistant("x1", [{ type: "text" }], undefined, "claude-haiku-5-5"),
			]),
		);

		await runHook("subagent-stop", {
			session_id: "s1",
			transcript_path: main,
			agent_transcript_path: sub,
			agent_id: "a1",
			agent_type: "Explore",
			cwd: dir,
		});

		expect(records()[0]).toMatchObject({
			sn: "parent",
			mod: "anthropic/claude-haiku-5-5",
			metadata: { agent_id: "a1", agent_type: "Explore" },
		});
	});

	test("start reports repo totals; uploads only with a cloud config", async () => {
		const input = { session_id: "s1", cwd: dir };
		const local = await runHook("start", input);
		expect(local.output?.systemMessage).toContain("0 tokens");
		expect(local.upload).toBe(false);

		const config = join(dir, "config", "hashtrack");
		const { mkdirSync } = await import("node:fs");
		mkdirSync(config, { recursive: true });
		writeFileSync(join(config, "config.json"), '{"token":"t"}');
		expect((await runHook("start", input)).upload).toBe(true);
	});

	test("a missing transcript records nothing", async () => {
		const result = await runHook("stop", {
			session_id: "s1",
			transcript_path: join(dir, "nope.jsonl"),
			cwd: dir,
		});
		expect(result.upload).toBe(false);
		expect(records()).toEqual([]);
	});
});
