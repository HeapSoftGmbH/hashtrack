import { describe, expect, test } from "bun:test";
import { witnessText } from "./format";

describe("witnessText", () => {
	test("leaves out the mark so the UI can draw the favicon", () => {
		expect(witnessText(12_345, 0.42)).toBe("12K · $0.42");
	});
});
