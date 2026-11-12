import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	compactNumberFormatter,
	dollarNumberFormatter,
	hashtrackColor,
	hashtrackMark,
} from "@hashtrack/lib";
import {
	compact,
	dollars,
	FAVICON,
	MARK,
	MARK_COLOR,
	repoLabel,
} from "../hooks/brand";

// hooks/brand.ts copies these because the UI module cannot import the
// workspace packages; this is what keeps the copies honest.
describe("the UI module's brand copies", () => {
	test("match packages/lib", () => {
		expect(MARK).toBe(hashtrackMark);
		expect(MARK_COLOR).toBe(hashtrackColor);
		expect(compact.resolvedOptions()).toEqual(
			compactNumberFormatter.resolvedOptions(),
		);
		expect(dollars.resolvedOptions()).toEqual(
			dollarNumberFormatter.resolvedOptions(),
		);
	});

	test("match the local-web favicon", () => {
		const svg = readFileSync(
			new URL(
				"../../../packages/local-web/public/favicon.svg",
				import.meta.url,
			),
			"utf8",
		);
		expect(FAVICON).toBe(svg.replace(/>\s+</g, "><").trim());
	});

	test("repoLabel formats the repo total", () => {
		expect(repoLabel(1_234_567, 3.4)).toBe("1.2M tokens · $3.40 in this repo");
	});
});
