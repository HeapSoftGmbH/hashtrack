import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";

const SUMMARY = {
	repo: { tokens: 3_300_000, cost: 2.44 },
	session: { tokens: 412_000, cost: 0.31, turns: 23 },
	models: [
		{ name: "claude-opus-5-5", cost: 2.12 },
		{ name: "claude-haiku-5-5", cost: 0.32 },
	],
	tools: [
		{ name: "Bash", calls: 41, errors: 2 },
		{ name: "Read", calls: 12, errors: 0 },
	],
};

const FOOTER = {
	plugin: "hashtrack",
	component: "SessionMode",
	props: { modes: ["focus"] },
} as const;

const PANE = {
	plugin: "hashtrack",
	component: "Pane",
	requestId: "Hashtrack",
	props: {
		title: "Hashtrack",
		isFocused: false,
		bodyColumns: 40,
		placement: "dock",
		scroll: { offset: 0, bodyRows: 20 },
		view: {},
	},
} as const;

/** Hooks that stand for the engine beneath the plugin. */
function engine(
	on: On,
	stdout: string,
	exitCode = 0,
	// `node --version`'s output; null: node cannot start
	nodeVersion: string | null = "v24.11.0",
) {
	const runs: string[][] = [];
	const opened: string[] = [];
	on("session.id", () => ({ value: "s1" }));
	// The recorder's own Stop command hook, which records the turn
	on("classic.Stop", () => ({}));
	on("process.run", (_, e) => {
		if (e.argv[1] === "--version") {
			if (nodeVersion === null) throw new Error("spawn node ENOENT");
			return {
				value: {
					exitCode: 0,
					stdout: `${nodeVersion}\n`,
					stderr: "",
					isStdoutTruncated: false,
					isStderrTruncated: false,
				},
			};
		}
		runs.push([...e.argv]);
		return {
			value: {
				exitCode,
				stdout,
				stderr: "",
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		};
	});
	on("ui.open", (_, e) => {
		opened.push(e.id);
		return { value: { isPlaced: true } };
	});
	on("ui.render", ($, e) => {
		const { Text } = $.ui.resolve(e);
		return <Text>engine</Text>;
	});
	return { runs, opened };
}

test("after Stop the footer shows the repo total read from the recorder", async ($, on) => {
	const { runs } = engine(on, JSON.stringify(SUMMARY));

	const before = await $.ui.mount({ ...FOOTER, surface: "desktop" });
	expect((await before.find({ key: "totals" }))?.text).toBe("⣏ Hashtrack");
	await before.unmount();

	await $.classic.Stop({ stop_hook_active: false });

	const after = await $.ui.mount({ ...FOOTER, surface: "desktop" });
	expect((await after.find({ key: "totals" }))?.text).toBe("⣏ 3.3M · $2.44");
	expect(runs[0]?.[0]).toBe("node");
	expect(runs[0]?.[1]).toMatch(/\/dist\/hook\.js$/);
	expect(runs[0]?.slice(2)).toEqual(["totals", "s1"]);
});

test("the footer is a button that opens the pane on every surface", async ($, on) => {
	const { opened } = engine(on, JSON.stringify(SUMMARY));
	await $.classic.Stop({ stop_hook_active: false });

	for (const surface of ["terminal", "desktop"] as const) {
		const ui = await $.ui.mount({ ...FOOTER, surface });
		const button = await ui.find({ key: "totals" });
		expect(button?.type).toBe("Button");
		expect(button?.text).toBe("⣏ 3.3M · $2.44");

		await ui.press({ key: "totals" });
		await ui.unmount();
	}

	expect(opened).toEqual(["Hashtrack", "Hashtrack"]);
});

test("the pane shows the totals, models and tools on every surface", async ($, on) => {
	engine(on, JSON.stringify(SUMMARY));
	await $.classic.Stop({ stop_hook_active: false });

	for (const surface of ["desktop", "vscode", "mobile"] as const) {
		const ui = await $.ui.mount({ ...PANE, surface });
		expect(await ui.find({ type: "Svg" })).toBeDefined();
		expect(
			await ui.find({ text: /3\.3M tokens · \$2\.44 in this repo/ }),
		).toBeDefined();
		await ui.unmount();
	}

	const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
	expect((await ui.find({ type: "Text", text: /^⣏/ }))?.text).toContain("3.3M");
	expect(await ui.find({ text: /412K · \$0\.31 · 23 turns/ })).toBeDefined();
	expect(await ui.find({ text: /claude-opus-5-5 \$2\.12/ })).toBeDefined();
	expect(await ui.find({ text: /Bash 41 calls, 2 errors/ })).toBeDefined();
});

test("a failed or garbled read keeps the placeholder", async ($, on) => {
	engine(on, "not json");
	await $.classic.Stop({ stop_hook_active: false });

	const footer = await $.ui.mount({ ...FOOTER, surface: "desktop" });
	expect((await footer.find({ key: "totals" }))?.text).toBe("⣏ Hashtrack");
	const pane = await $.ui.mount({ ...PANE, surface: "desktop" });
	expect(await pane.find({ text: /No usage yet/ })).toBeDefined();
});

test("without Node.js the footer and the pane say that nothing is recorded", async ($, on) => {
	const { runs, opened } = engine(on, JSON.stringify(SUMMARY), 0, null);

	// Opening the pane checks for Node.js, as session start does
	const ui = await $.ui.mount({ ...FOOTER, surface: "terminal" });
	await ui.press({ key: "totals" });
	expect(opened).toEqual(["Hashtrack"]);
	expect((await ui.find({ key: "totals" }))?.text).toBe(
		"⣏ Hashtrack needs Node.js",
	);

	const pane = await $.ui.mount({ ...PANE, surface: "desktop" });
	expect(await pane.find({ text: /Hashtrack is not recording/ })).toBeDefined();
	expect(
		await pane.find({ text: /not installed, or not on the PATH/ }),
	).toBeDefined();
	expect((await pane.find({ type: "Link" }))?.props).toMatchObject({
		href: "https://nodejs.org",
	});
	// no totals read was even tried
	expect(runs).toEqual([]);
});

test("a Node.js older than 18 is named in the pane", async ($, on) => {
	engine(on, JSON.stringify(SUMMARY), 0, "v16.20.2");
	const footer = await $.ui.mount({ ...FOOTER, surface: "desktop" });
	await footer.press({ key: "totals" });

	const pane = await $.ui.mount({ ...PANE, surface: "terminal" });
	expect(
		await pane.find({ text: /Found Node.js v16.20.2; Hashtrack needs 18/ }),
	).toBeDefined();
});

test("a supported Node.js shows the totals", async ($, on) => {
	engine(on, JSON.stringify(SUMMARY), 0, "v18.0.0");
	const ui = await $.ui.mount({ ...FOOTER, surface: "desktop" });
	await ui.press({ key: "totals" });

	expect((await ui.find({ key: "totals" }))?.text).toBe("⣏ 3.3M · $2.44");
});
