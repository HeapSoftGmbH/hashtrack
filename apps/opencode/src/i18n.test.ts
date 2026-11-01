import { describe, expect, test } from "bun:test";
import { catalog } from "./i18n";

const keys = Object.keys(catalog.en).sort();

describe("i18n catalog", () => {
	// OpenCode's interface ships exactly these 63 locales.
	test("covers every OpenCode locale", () => {
		expect(Object.keys(catalog)).toHaveLength(63);
	});

	test("translates every key in every locale", () => {
		for (const [locale, messages] of Object.entries(catalog)) {
			expect(Object.keys(messages).sort(), locale).toEqual(keys);
		}
	});

	test("keeps the {{error}} placeholder", () => {
		for (const [locale, messages] of Object.entries(catalog)) {
			expect(messages.openFailed, locale).toContain("{{error}}");
		}
	});
});
