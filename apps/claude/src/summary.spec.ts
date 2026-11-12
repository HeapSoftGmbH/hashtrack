import { describe, expect, test } from "bun:test";
import {
	type AgentTurnRecord,
	tallyRecords,
	type Usage,
} from "@hashtrack/core";
import { usageSummary } from "./summary";

function summarize(records: AgentTurnRecord[], sessionId?: string) {
	return usageSummary(tallyRecords(records), sessionId);
}

function usage(tok: number, cst: number): Usage {
	return { in: 0, out: 0, cw: 0, cr: 0, tok, reason: 0, cst };
}

function record(
	sid: string,
	mod: string,
	turns: Array<{
		tok: number;
		cst: number;
		tools?: string[];
		errors?: string[];
	}>,
): AgentTurnRecord {
	return {
		t: "2026-11-11T00:00:00.000Z",
		sid,
		sn: "",
		h: "claude",
		mod,
		rep: "repo",
		turns: turns.map((turn, ti) => ({
			ti,
			totalUsage: usage(turn.tok, turn.cst),
			tools: [
				...(turn.tools ?? []).map((name) => ({ name, isError: false })),
				...(turn.errors ?? []).map((name) => ({ name, isError: true })),
			],
		})),
	};
}

describe("usageSummary", () => {
	test("sums the repo, picks the session, ranks models and tools", () => {
		const summary = summarize(
			[
				record("a", "claude-opus-5-5", [
					{ tok: 100, cst: 1, tools: ["Bash", "Read"] },
					{ tok: 50, cst: 0.5, tools: ["Bash"], errors: ["Bash"] },
				]),
				record("b", "claude-haiku-5-5", [
					{ tok: 30, cst: 0.25, tools: ["Edit"] },
				]),
			],
			"b",
		);

		expect(summary.repo).toEqual({ tokens: 180, cost: 1.75 });
		expect(summary.session).toEqual({ tokens: 30, cost: 0.25, turns: 1 });
		expect(summary.models).toEqual([
			{ name: "claude-opus-5-5", cost: 1.5 },
			{ name: "claude-haiku-5-5", cost: 0.25 },
		]);
		expect(summary.tools[0]).toEqual({ name: "Bash", calls: 3, errors: 1 });
		expect(summary.tools.map((t) => t.name)).toEqual(["Bash", "Read", "Edit"]);
	});

	test("an unknown or absent session counts nothing", () => {
		const records = [record("a", "m", [{ tok: 10, cst: 1 }])];

		expect(summarize(records).session).toEqual({
			tokens: 0,
			cost: 0,
			turns: 0,
		});
		expect(summarize(records, "x").session.turns).toBe(0);
	});

	test("keeps the top five and tolerates old records without turns", () => {
		const many = ["A", "B", "C", "D", "E", "F"].map((name, i) =>
			record("a", `m${i}`, [{ tok: 1, cst: i, tools: [name] }]),
		);
		const old = {
			...record("a", "m", []),
			turns: undefined,
		} as unknown as AgentTurnRecord;

		const summary = summarize([...many, old]);

		expect(summary.models).toHaveLength(5);
		expect(summary.models[0]?.name).toBe("m5");
		expect(summary.tools).toHaveLength(5);
	});
});
