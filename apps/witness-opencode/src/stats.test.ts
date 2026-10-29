import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTurnRecord } from "witness";
import { repoStats } from "./stats";

const dirs: string[] = [];

const repo = (files: Record<string, string[]> = {}): string => {
	const dir = mkdtempSync(join(tmpdir(), "witness-stats-"));
	dirs.push(dir);
	mkdirSync(join(dir, ".witness"), { recursive: true });
	for (const [name, lines] of Object.entries(files)) {
		writeFileSync(join(dir, ".witness", name), lines.join("\n"));
	}
	return dir;
};

const record = (
	sid: string,
	turns: Array<{ tok: number; cst: number }>,
): string =>
	JSON.stringify({
		t: "2026-01-01T00:00:00.000Z",
		sid,
		sn: "",
		h: "test",
		rep: "",
		mod: "test/model",
		turns: turns.map((usage, ti) => ({
			ti,
			tools: [],
			totalUsage: {
				in: 0,
				out: 0,
				cw: 0,
				cr: 0,
				tok: usage.tok,
				reason: 0,
				cst: usage.cst,
			},
		})),
	} satisfies AgentTurnRecord);

afterEach(() => {
	for (const dir of dirs.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

describe("repoStats", () => {
	test("empty repo has zero totals", () => {
		expect(repoStats(repo())).toEqual({
			tokens: 0,
			cost: 0,
			sessions: 0,
			turns: 0,
			records: 0,
		});
	});

	test("caches totals until a file changes", () => {
		const dir = repo({
			"usage.jsonl": [record("ses-1", [{ tok: 1, cst: 0.01 }])],
		});

		const first = repoStats(dir);
		expect(repoStats(dir)).toBe(first);

		writeFileSync(
			join(dir, ".witness", "usage.jsonl"),
			`${record("ses-1", [{ tok: 12_345, cst: 0.02 }])}\n`,
		);
		expect(repoStats(dir).tokens).toBe(12_345);
	});

	test("sums tokens and cost across pending and synced records", () => {
		const dir = repo({
			"usage.jsonl": [
				record("ses-1", [
					{ tok: 100, cst: 0.1 },
					{ tok: 50, cst: 0.05 },
				]),
			],
			"synced.jsonl": [
				record("ses-1", [{ tok: 25, cst: 0.02 }]),
				record("ses-2", [{ tok: 10, cst: 0.01 }]),
			],
		});

		const stats = repoStats(dir);
		expect(stats).toMatchObject({
			tokens: 185,
			// one session appears in both files: deduped by id
			sessions: 2,
			turns: 4,
			records: 3,
		});
		expect(stats.cost).toBeCloseTo(0.18, 10);
	});

	test("malformed lines and missing usage are skipped", () => {
		const dir = repo({
			"usage.jsonl": [
				"{ not json",
				JSON.stringify({ sid: "ses-1", h: "test", turns: [] }),
				JSON.stringify({ sid: "ses-2", h: "test" }),
			],
		});

		expect(() => repoStats(dir)).not.toThrow();
		const stats = repoStats(dir);
		expect(stats.sessions).toBe(2);
		expect(stats.turns).toBe(0);
		expect(stats.tokens).toBe(0);
	});
});
