import type { TranscriptLine } from "./transcript";

let n = 0;
const uuid = () => `u${++n}`;

export function prompt(text: string): TranscriptLine {
	return {
		type: "user",
		uuid: uuid(),
		timestamp: "2026-11-11T10:00:00.000Z",
		version: "2.1.321",
		message: { content: text },
	};
}

/** One transcript line per content block, as Claude Code writes them. */
export function assistant(
	id: string,
	contentBlocks: unknown[],
	usage = { input_tokens: 10, output_tokens: 5 },
	model = "claude-opus-5-5",
): TranscriptLine[] {
	return contentBlocks.map((block) => ({
		type: "assistant",
		uuid: uuid(),
		version: "2.1.321",
		message: { id, model, usage, content: [block] },
	}));
}

export function toolUse(id: string, name: string, input: unknown = {}) {
	return { type: "tool_use", id, name, input };
}

export function toolResult(id: string, isError = false): TranscriptLine {
	return {
		type: "user",
		uuid: uuid(),
		message: {
			content: [{ type: "tool_result", tool_use_id: id, is_error: isError }],
		},
	};
}

export function jsonl(lines: TranscriptLine[]): string {
	return `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
}
