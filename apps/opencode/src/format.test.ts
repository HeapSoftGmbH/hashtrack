import { describe, expect, test } from "bun:test";
import { hashtrackText } from "./format";

describe("hashtrackText", () => {
	test("leaves out the mark so the UI can draw the favicon", () => {
		expect(hashtrackText(12_345, 0.42)).toBe("12K · $0.42");
	});
});
