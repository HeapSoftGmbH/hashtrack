import type { Tool, Usage } from "@hashtrack/core";
import { type MessageUsage, messageCost } from "./pricing";

/** One line of a Claude Code transcript (`~/.claude/projects/<dir>/<session>.jsonl`). Only the fields we read. */
export interface TranscriptLine {
	type?: string;
	uuid?: string;
	timestamp?: string;
	version?: string;
	isMeta?: boolean;
	isCompactSummary?: boolean;
	customTitle?: string;
	message?: {
		id?: string;
		model?: string;
		content?: unknown;
		usage?: MessageUsage;
	};
}

interface Block {
	type?: string;
	id?: string;
	name?: string;
	input?: { skill?: unknown };
	tool_use_id?: string;
	is_error?: boolean;
	text?: string;
}

/** Where the previous Stop left off, so a burst is never recorded twice. */
export interface Cursor {
	uuid: string; // last transcript line already recorded
	messageId?: string; // its assistant message; later lines of that message are skipped
}

export interface Burst {
	startedAt: string;
	model: string;
	harnessVersion?: string;
	turns: { tools: Tool[]; totalUsage: Usage }[];
	skills: string[];
	cursor?: Cursor;
}

export function parseTranscript(text: string): TranscriptLine[] {
	const lines: TranscriptLine[] = [];
	for (const raw of text.split("\n")) {
		if (!raw.trim()) continue;
		try {
			lines.push(JSON.parse(raw) as TranscriptLine);
		} catch {
			// a line still being written, or an unknown format
		}
	}
	return lines;
}

function blocks(line: TranscriptLine): Block[] {
	const content = line.message?.content;
	return Array.isArray(content) ? (content as Block[]) : [];
}

/** A prompt the user typed, as opposed to tool results and injected meta lines. */
export function isUserPrompt(line: TranscriptLine): boolean {
	if (line.type !== "user" || line.isMeta || line.isCompactSummary)
		return false;
	const content = line.message?.content;
	if (typeof content === "string") return true;
	return blocks(line).every((b) => b.type !== "tool_result");
}

/** The session name the user set with `/rename`, if any. */
export function sessionName(lines: TranscriptLine[]): string {
	let name = "";
	for (const line of lines) {
		if (line.type === "custom-title" && typeof line.customTitle === "string")
			name = line.customTitle;
	}
	return name;
}

/**
 * Lines not recorded yet: everything after the cursor, or — without a usable
 * cursor (first Stop of a session, or a plugin installed mid-session) — the
 * last prompt and what followed it, so old history is not imported in bulk.
 */
export function pendingLines(
	lines: TranscriptLine[],
	cursor?: Cursor,
): TranscriptLine[] {
	if (cursor) {
		const at = lines.findIndex((l) => l.uuid === cursor.uuid);
		if (at >= 0)
			return lines
				.slice(at + 1)
				.filter((l) => !cursor.messageId || l.message?.id !== cursor.messageId);
	}
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line && isUserPrompt(line)) return lines.slice(i);
	}
	return lines;
}

function promptCommand(line: TranscriptLine): string | undefined {
	const content = line.message?.content;
	const text =
		typeof content === "string"
			? content
			: blocks(line)
					.map((b) => b.text ?? "")
					.join("\n");
	return text.match(/<command-name>\/?([^<\s]+)<\/command-name>/)?.[1];
}

function toUsage(model: string, u: MessageUsage | undefined): Usage {
	const usage = u ?? {};
	const input = usage.input_tokens || 0;
	const output = usage.output_tokens || 0;
	const cw = usage.cache_creation_input_tokens || 0;
	const cr = usage.cache_read_input_tokens || 0;
	return {
		in: input,
		out: output,
		cw,
		cr,
		// output_tokens already includes thinking tokens
		tok: input + output + cw + cr,
		reason: usage.output_tokens_details?.thinking_tokens || 0,
		cst: messageCost(model, usage),
	};
}

/**
 * Fold transcript lines into one agent burst: one turn per assistant message
 * (Claude Code writes a line per content block, all sharing `message.id` and
 * usage), with the tools it called and whether their results were errors.
 */
export function buildBurst(lines: TranscriptLine[]): Burst | undefined {
	const messages = new Map<
		string,
		{ model: string; usage?: MessageUsage; tools: Map<string, string> }
	>();
	const errors = new Map<string, boolean>();
	const skills: string[] = [];
	let harnessVersion: string | undefined;
	let cursor: Cursor | undefined;

	for (const line of lines) {
		if (line.version) harnessVersion = line.version;
		if (line.uuid) cursor = { uuid: line.uuid, messageId: line.message?.id };

		if (line.type === "user") {
			for (const b of blocks(line)) {
				if (b.type === "tool_result" && b.tool_use_id)
					errors.set(b.tool_use_id, b.is_error === true);
			}
			const command = isUserPrompt(line) ? promptCommand(line) : undefined;
			if (command) skills.push(command);
			continue;
		}

		const id = line.message?.id;
		const model = line.message?.model ?? "";
		if (line.type !== "assistant" || !id || model === "<synthetic>") continue;

		let msg = messages.get(id);
		if (!msg) {
			msg = { model, tools: new Map() };
			messages.set(id, msg);
		}
		if (line.message?.usage) msg.usage = line.message.usage;
		for (const b of blocks(line)) {
			if (b.type !== "tool_use" || !b.id || !b.name) continue;
			msg.tools.set(b.id, b.name);
			if (b.name === "Skill" && typeof b.input?.skill === "string")
				skills.push(b.input.skill);
		}
	}

	if (messages.size === 0) return undefined;

	const turns = [...messages.values()].map((msg) => ({
		tools: [...msg.tools].map(([id, name]) => ({
			name,
			isError: errors.get(id) ?? false,
		})),
		totalUsage: toUsage(msg.model, msg.usage),
	}));
	const last = [...messages.values()].pop();

	return {
		startedAt:
			lines.find((l) => l.timestamp)?.timestamp ?? new Date().toISOString(),
		model: last?.model ? `anthropic/${last.model}` : "",
		harnessVersion,
		turns,
		skills,
		cursor,
	};
}
