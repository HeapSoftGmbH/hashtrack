import { describe, expect, test } from "bun:test";
import { messageCost } from "./pricing";

describe("messageCost", () => {
	test("prices input, output and cache reads", () => {
		const cost = messageCost("claude-opus-5-5", {
			input_tokens: 1_000_000,
			output_tokens: 1_000_000,
			cache_read_input_tokens: 1_000_000,
		});
		expect(cost).toBeCloseTo(4 + 20 + 0.2);
	});

	test("splits cache writes into 5m (1.25x) and 1h (2x)", () => {
		const cost = messageCost("claude-sonnet-5-5", {
			cache_creation_input_tokens: 2_000_000,
			cache_creation: { ephemeral_1h_input_tokens: 1_000_000 },
		});
		expect(cost).toBeCloseTo(2 * 1.25 + 2 * 2);
	});

	test("matches the most specific model prefix", () => {
		const usage = { output_tokens: 1_000_000 };
		expect(messageCost("claude-opus-4-1-20250805", usage)).toBe(75);
		expect(messageCost("claude-opus-4-8", usage)).toBe(25);
	});

	test("ignores provider prefixes and context suffixes", () => {
		const usage = { input_tokens: 1_000_000 };
		expect(messageCost("us.anthropic.claude-opus-5-5", usage)).toBe(4);
		expect(messageCost("claude-opus-5-5[1m]", usage)).toBe(4);
	});

	test("doubles fast mode", () => {
		expect(
			messageCost("claude-opus-5-5", {
				input_tokens: 1_000_000,
				speed: "fast",
			}),
		).toBe(8);
	});

	test("prices the Claude 3 models by their own rates", () => {
		const usage = { output_tokens: 1_000_000 };
		expect(messageCost("claude-3-7-sonnet-20250219", usage)).toBe(15);
		expect(
			messageCost("us.anthropic.claude-3-5-sonnet-20241022-v2:0", usage),
		).toBe(15);
		expect(messageCost("claude-3-5-haiku-20241022", usage)).toBe(4);
		expect(messageCost("claude-3-haiku-20240307", usage)).toBe(1.25);
		expect(messageCost("claude-3-opus-20240229", usage)).toBe(75);
	});

	test("unknown models cost nothing", () => {
		expect(messageCost("gpt-5", { input_tokens: 1_000_000 })).toBe(0);
	});
});
