import { describe, expect, test } from "bun:test";
import { assistant, prompt, toolResult, toolUse } from "./fixtures";
import {
	buildBurst,
	isUserPrompt,
	parseTranscript,
	pendingLines,
	sessionName,
} from "./transcript";

describe("parseTranscript", () => {
	test("skips malformed and blank lines", () => {
		const lines = parseTranscript('{"type":"user"}\n\nnot json\n{"type":');
		expect(lines).toEqual([{ type: "user" }]);
	});
});

describe("isUserPrompt", () => {
	test("tool results and meta lines are not prompts", () => {
		expect(isUserPrompt(prompt("hi"))).toBe(true);
		expect(isUserPrompt(toolResult("t1"))).toBe(false);
		expect(isUserPrompt({ ...prompt("x"), isMeta: true })).toBe(false);
		expect(isUserPrompt({ ...prompt("x"), isCompactSummary: true })).toBe(
			false,
		);
	});
});

describe("buildBurst", () => {
	test("one turn per message id, usage counted once", () => {
		const burst = buildBurst([
			prompt("go"),
			...assistant("m1", [{ type: "thinking" }, toolUse("t1", "Bash")], {
				input_tokens: 100,
				output_tokens: 50,
			}),
			toolResult("t1", true),
			...assistant("m2", [{ type: "text", text: "done" }]),
		]);

		expect(burst?.turns).toHaveLength(2);
		expect(burst?.turns[0]?.tools).toEqual([{ name: "Bash", isError: true }]);
		expect(burst?.turns[0]?.totalUsage.tok).toBe(150);
		expect(burst?.turns[1]?.tools).toEqual([]);
		expect(burst?.model).toBe("anthropic/claude-opus-5-5");
		expect(burst?.harnessVersion).toBe("2.1.321");
	});

	test("maps cache tokens, reasoning and cost", () => {
		const burst = buildBurst(
			assistant("m1", [{ type: "text" }], {
				input_tokens: 1,
				output_tokens: 2,
				cache_creation_input_tokens: 3,
				cache_read_input_tokens: 4,
				output_tokens_details: { thinking_tokens: 2 },
			} as never),
		);
		const usage = burst?.turns[0]?.totalUsage;
		expect(usage).toMatchObject({ in: 1, out: 2, cw: 3, cr: 4, tok: 10 });
		expect(usage?.reason).toBe(2);
		expect(usage?.cst).toBeGreaterThan(0);
	});

	test("collects skills from the Skill tool and slash commands", () => {
		const burst = buildBurst([
			prompt("<command-name>/review</command-name>"),
			...assistant("m1", [toolUse("t1", "Skill", { skill: "pdf" })]),
		]);
		expect(burst?.skills).toEqual(["review", "pdf"]);
	});

	test("ignores synthetic messages; no assistant output means no burst", () => {
		const lines = [
			prompt("hi"),
			...assistant("m1", [{ type: "text" }], undefined, "<synthetic>"),
		];
		expect(buildBurst(lines)).toBeUndefined();
	});

	test("cursor points at the last line", () => {
		const lines = [prompt("go"), ...assistant("m1", [{ type: "text" }])];
		expect(buildBurst(lines)?.cursor).toEqual({
			uuid: lines.at(-1)?.uuid ?? "",
			messageId: "m1",
		});
	});
});

describe("pendingLines", () => {
	const first = [prompt("one"), ...assistant("a", [{ type: "text" }])];
	const second = [
		prompt("two"),
		...assistant("b", [{ type: "thinking" }, { type: "text" }]),
	];
	const all = [...first, ...second];

	test("without a cursor, starts at the last prompt", () => {
		expect(pendingLines(all)).toEqual(second);
	});

	test("with a cursor, takes everything after it", () => {
		const cursor = { uuid: first.at(-1)?.uuid ?? "" };
		expect(pendingLines(all, cursor)).toEqual(second);
	});

	test("skips later lines of the message the cursor stopped in", () => {
		const cursor = { uuid: second[1]?.uuid ?? "", messageId: "b" };
		expect(pendingLines(all, cursor)).toEqual([]);
	});

	test("falls back to the last prompt when the cursor is gone", () => {
		expect(pendingLines(all, { uuid: "missing" })).toEqual(second);
	});
});

describe("sessionName", () => {
	test("uses the latest custom title", () => {
		expect(
			sessionName([
				{ type: "custom-title", customTitle: "a" },
				{ type: "custom-title", customTitle: "b" },
			]),
		).toBe("b");
		expect(sessionName([])).toBe("");
	});
});
