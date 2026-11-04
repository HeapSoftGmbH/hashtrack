import { describe, expect, test } from "bun:test";
import { Suspense } from "solid-js";
import { createRenderer } from "solid-js/universal";
import { createStatsState } from "./gui-stats";
import type { StatsResult } from "./rpc";

// The Suspense test needs Solid's browser runtime: the node/SSR build has no
// effects, so it cannot show whether a refresh trips the Suspense counter.
const browserRuntime = import.meta
	.resolve("solid-js")
	.endsWith("/dist/solid.js");

type Node = {
	kind: "root" | "text" | "element";
	tag?: string;
	text?: string;
	children: Node[];
	parent?: Node;
};

function make(kind: Node["kind"], extra: Partial<Node> = {}): Node {
	return { kind, children: [], ...extra };
}

const renderer = createRenderer<Node>({
	createElement: (tag) => make("element", { tag }),
	createTextNode: (value) => make("text", { text: value }),
	replaceText: (node, value) => {
		node.text = value;
	},
	isTextNode: (node) => node.kind === "text",
	setProperty: () => {},
	insertNode: (parent, node, anchor) => {
		const index = anchor ? parent.children.indexOf(anchor) : -1;
		node.parent = parent;
		if (index < 0) parent.children.push(node);
		else parent.children.splice(index, 0, node);
	},
	removeNode: (parent, node) => {
		const index = parent.children.indexOf(node);
		if (index >= 0) parent.children.splice(index, 1);
		node.parent = undefined;
	},
	getParentNode: (node) => node.parent,
	getFirstChild: (node) => node.children[0],
	getNextSibling: (node) => {
		const parent = node.parent;
		if (!parent) return undefined;
		const index = parent.children.indexOf(node);
		return parent.children[index + 1];
	},
});

const text = (node: Node): string =>
	node.kind === "text" ? (node.text ?? "") : node.children.map(text).join("");

const stats = (tokens: number): StatsResult => ({
	tokens,
	cost: 0,
	sessions: 0,
	turns: 0,
	records: 0,
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createStatsState", () => {
	test("ignores a response for a directory the user already left", async () => {
		let directory = "/old";
		const pending: Array<(value: StatsResult) => void> = [];
		const { stats: value, refresh } = createStatsState(
			() => new Promise<StatsResult>((resolve) => pending.push(resolve)),
			() => directory,
		);

		void refresh("/old");
		directory = "/new";
		pending.shift()?.(stats(1));
		await tick();

		expect(value()).toBeUndefined();
	});

	test("ignores a failed response for a directory the user already left", async () => {
		let directory = "/old";
		const pending: Array<{
			resolve: (value: StatsResult) => void;
			reject: (error: unknown) => void;
		}> = [];
		const { stats: value, refresh } = createStatsState(
			() =>
				new Promise<StatsResult>((resolve, reject) =>
					pending.push({ resolve, reject }),
				),
			() => directory,
		);

		// seed /old so `last` holds a total for it
		const seed = refresh("/old");
		pending.shift()?.resolve(stats(1));
		await seed;
		expect(value()?.tokens).toBe(1);

		// this /old refresh is still in flight when the user moves to /new
		const late = refresh("/old");
		directory = "/new";
		pending.shift()?.reject(new Error("down"));
		await late;

		expect(value()).toBeUndefined();
	});

	test("lets the newest of overlapping requests win", async () => {
		const pending: Array<(value: StatsResult) => void> = [];
		const { stats: value, refresh } = createStatsState(
			() => new Promise<StatsResult>((resolve) => pending.push(resolve)),
			() => "/repo",
		);

		const older = refresh("/repo");
		const newer = refresh("/repo");

		pending[1]?.(stats(2));
		await newer;
		expect(value()?.tokens).toBe(2);

		pending[0]?.(stats(1));
		await older;
		expect(value()?.tokens).toBe(2);
	});

	test("keeps the last total when a refresh fails", async () => {
		const directory = "/repo";
		let calls = 0;
		const { stats: value, refresh } = createStatsState(
			async () => {
				calls += 1;
				if (calls === 1) return stats(1);
				throw new Error("down");
			},
			() => directory,
		);

		await refresh("/repo");
		expect(value()?.tokens).toBe(1);

		await refresh("/repo");
		expect(value()?.tokens).toBe(1);
	});

	test("clears a total from another directory when a refresh fails", async () => {
		let directory = "/old";
		const { stats: value, refresh } = createStatsState(
			async () => {
				if (directory === "/old") return stats(1);
				throw new Error("down");
			},
			() => directory,
		);

		await refresh("/old");
		expect(value()?.tokens).toBe(1);

		directory = "/new";
		await refresh("/new");
		expect(value()).toBeUndefined();
	});

	// Regression: refetching a Solid resource increments the nearest Suspense
	// counter, and OpenCode Desktop wraps the whole window in a Suspense
	// boundary. A resource-backed badge therefore replaced the entire window
	// with its fallback every 10 seconds. A plain signal must not do that.
	test.skipIf(!browserRuntime)(
		"a refresh does not trip the window's Suspense fallback",
		async () => {
			const pending: Array<(value: StatsResult) => void> = [];
			const { stats: value, refresh } = createStatsState(
				() => new Promise<StatsResult>((resolve) => pending.push(resolve)),
				() => "/repo",
			);

			const Badge = () => () =>
				value() ? `tokens:${value()?.tokens}` : "empty";
			const component = renderer.createComponent as unknown as (
				comp: unknown,
				props: unknown,
			) => unknown;
			const root = make("root");
			const dispose = renderer.render(
				() =>
					component(Suspense, {
						fallback: "FALLBACK",
						get children() {
							return component(Badge, {});
						},
					}) as Node,
				root,
			);

			void refresh("/repo");
			expect(text(root)).toBe("empty");

			pending.shift()?.(stats(1));
			await tick();
			expect(text(root)).toBe("tokens:1");

			// the load stays in flight: the badge must keep its value instead of
			// swapping the whole Suspense boundary for the fallback
			void refresh("/repo");
			await tick();
			expect(text(root)).toBe("tokens:1");
			expect(text(root)).not.toContain("FALLBACK");

			pending.shift()?.(stats(2));
			await tick();
			expect(text(root)).toBe("tokens:2");

			dispose();
		},
	);
});
