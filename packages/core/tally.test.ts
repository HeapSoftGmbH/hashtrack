import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	appendFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type AgentTurnRecord,
	readRepoRecords,
	repoTally,
	tallyRecords,
} from "./index";

let dir: string;
let data: string;
let cache: string;
const env = { ...process.env };

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "hashtrack-tally-"));
	data = join(dir, "data");
	cache = join(dir, "cache");
	process.env.HASHTRACK_DIR = data;
	mkdirSync(data);
});

afterEach(() => {
	process.env = { ...env };
	rmSync(dir, { recursive: true, force: true });
});

function line(sid: string, tok: number, tool = "Bash"): string {
	const record: AgentTurnRecord = {
		t: "2026-11-11T00:00:00.000Z",
		sid,
		sn: "",
		h: "claude",
		mod: "anthropic/claude-opus-5-5",
		rep: dir,
		turns: [
			{
				ti: 0,
				totalUsage: {
					in: 0,
					out: 0,
					cw: 0,
					cr: 0,
					tok,
					reason: 0,
					cst: tok / 100,
				},
				tools: [{ name: tool, isError: false }],
			},
		],
	};
	return `${JSON.stringify(record)}\n`;
}

const usage = () => join(data, "usage.jsonl");
const synced = () => join(data, "synced.jsonl");
/** What a full read gives, to compare the cached reads against. */
const fresh = () => tallyRecords(readRepoRecords(dir));

describe("repoTally with a cache directory", () => {
	test("is empty without a log", () => {
		expect(repoTally(dir, cache).tokens).toBe(0);
	});

	test("reads only what was appended since the last call", () => {
		writeFileSync(usage(), "");
		appendFileSync(usage(), line("a", 100));
		expect(repoTally(dir, cache).tokens).toBe(100);

		appendFileSync(usage(), line("b", 50, "Read"));
		const tally = repoTally(dir, cache);
		expect(tally).toEqual(fresh());
		expect(tally.tokens).toBe(150);
		expect(tally.sessions.get("b")).toEqual({
			tokens: 50,
			cost: 0.5,
			turns: 1,
		});
		expect([...tally.tools.keys()]).toEqual(["Bash", "Read"]);
		expect(readdirSync(cache)).toHaveLength(1);
	});

	test("a line still being written counts once it is complete", () => {
		writeFileSync(usage(), line("a", 100));
		const partial = line("b", 50);
		appendFileSync(usage(), partial.slice(0, 20));
		expect(repoTally(dir, cache).tokens).toBe(100);

		appendFileSync(usage(), partial.slice(20));
		expect(repoTally(dir, cache).tokens).toBe(150);
	});

	test("an upload moving lines to synced.jsonl keeps the total", () => {
		writeFileSync(usage(), line("a", 100) + line("b", 50));
		expect(repoTally(dir, cache).tokens).toBe(150);

		// what Session.archive does: append to synced, rewrite usage via rename
		appendFileSync(synced(), line("a", 100));
		writeFileSync(`${usage()}.tmp`, line("b", 50));
		renameSync(`${usage()}.tmp`, usage());

		expect(repoTally(dir, cache)).toEqual(fresh());
		expect(repoTally(dir, cache).tokens).toBe(150);
	});

	test("a truncated file or a broken cache starts over", () => {
		writeFileSync(usage(), line("a", 100) + line("b", 50));
		repoTally(dir, cache);
		writeFileSync(usage(), line("c", 7));
		expect(repoTally(dir, cache).tokens).toBe(7);

		const [file] = readdirSync(cache);
		writeFileSync(join(cache, file ?? ""), "{not json");
		expect(repoTally(dir, cache).tokens).toBe(7);
		expect(
			JSON.parse(readFileSync(join(cache, file ?? ""), "utf8")).pending.offset,
		).toBeGreaterThan(0);
	});
});

describe("repoTally in process", () => {
	test("hands back the same tally until a file changes", () => {
		writeFileSync(usage(), line("a", 100));
		const first = repoTally(dir);
		expect(repoTally(dir)).toBe(first);

		appendFileSync(usage(), line("b", 50));
		const second = repoTally(dir);
		expect(second).not.toBe(first);
		expect(second).toEqual(fresh());
		expect(first.tokens).toBe(100);
	});

	test("counts a last line that has no newline", () => {
		writeFileSync(usage(), line("a", 100) + line("b", 50).trimEnd());
		expect(repoTally(dir).tokens).toBe(150);

		appendFileSync(usage(), `\n${line("c", 7)}`);
		expect(repoTally(dir)).toEqual(fresh());
		expect(repoTally(dir).tokens).toBe(157);
	});
});
