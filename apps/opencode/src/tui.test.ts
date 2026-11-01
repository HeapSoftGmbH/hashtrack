import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { StatsResult } from "./rpc";
import tui from "./tui";

interface Claim {
	append: string;
	render: (input: unknown) => unknown;
}

interface Command {
	id: string;
	title: string;
	palette?: boolean;
	slash?: { name: string };
	run: () => Promise<void>;
}

const stats: StatsResult = {
	tokens: 12_345,
	cost: 0.42,
	sessions: 3,
	turns: 9,
	records: 4,
};

let slots: Claim[];
let commands: Command[];
let toasts: Array<Record<string, unknown>>;
let spawns: unknown[][];
let statsCalls: unknown[];
let webCalls: unknown[];
let cleanup: Awaited<ReturnType<typeof tui.setup>>;
let originalSpawn: typeof Bun.spawn;

const start = async (
	directory = "/repo",
	options: { failing?: boolean; failingStatsOnly?: boolean } = {},
) => {
	slots = [];
	commands = [];
	toasts = [];
	statsCalls = [];
	webCalls = [];

	const fail = () => {
		throw new Error("down");
	};

	const context = {
		location: directory ? { directory } : undefined,
		app: { version: "2.2.1" },
		theme: { text: { base: "#ffffff" } },
		storage: {
			memory: <V extends object>(
				_key: string,
				initial: { initial: V },
			): readonly [V, (mutation: (draft: V) => void) => void] => {
				const value = { ...initial.initial };
				return [value, (mutation) => mutation(value)];
			},
		},
		keymap: {
			layer: (factory: () => { commands?: readonly Command[] }) => {
				commands.push(...((factory().commands ?? []) as Command[]));
			},
		},
		data: {
			on: () => () => {},
		},
		ui: {
			slot: (claim: Claim) => {
				slots.push(claim);
				return () => {};
			},
			toast: {
				show: (toast: Record<string, unknown>) => toasts.push(toast),
			},
		},
		client: {
			rpc: () => ({
				stats: async (input: unknown) => {
					statsCalls.push(input);
					if (options.failing || options.failingStatsOnly) return fail();
					return stats;
				},
				web: async (input: unknown) => {
					webCalls.push(input);
					if (options.failing) return fail();
					return {
						url: `http://127.0.0.1:4447/?dir=${encodeURIComponent(directory)}`,
					};
				},
			}),
		},
	};

	cleanup = await tui.setup(context as never);
};

beforeEach(() => {
	originalSpawn = Bun.spawn;
	spawns = [];
	Bun.spawn = ((command: unknown) => {
		spawns.push(command as unknown[]);
		return { exited: Promise.resolve(0) };
	}) as typeof Bun.spawn;
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	Bun.spawn = originalSpawn;
});

describe("hashtrack TUI part", () => {
	test("contributes the repo total to both footer slots", async () => {
		await start();

		expect(slots.map((slot) => slot.append)).toEqual([
			"prompt.footer.status",
			"home.footer.status",
		]);
		for (const slot of slots) expect(typeof slot.render).toBe("function");
		expect(statsCalls).toEqual([{ directory: "/repo" }]);
	});

	test("registers a /hashtrack command that opens the dashboard", async () => {
		await start();

		const command = commands.find((entry) => entry.slash?.name === "hashtrack");
		expect(command).toBeDefined();
		expect(command?.palette).toBe(true);

		await command?.run();

		expect(webCalls).toEqual([{ directory: "/repo" }]);
		expect(spawns).toHaveLength(1);
		const spawn = spawns[0] ?? [];
		expect(String(spawn[spawn.length - 1])).toBe(
			"http://127.0.0.1:4447/?dir=%2Frepo",
		);
		expect(toasts.at(-1)).toMatchObject({ variant: "success" });
	});

	test("omits the directory when the TUI location is unknown", async () => {
		await start("");
		await commands[0]?.run();
		expect(statsCalls[0]).toEqual({});
		expect(webCalls[0]).toEqual({});
	});

	test("reports a failed dashboard call as an error toast", async () => {
		await start("/repo", { failing: true });
		await commands[0]?.run();
		expect(toasts.at(-1)).toMatchObject({ variant: "error" });
	});

	test("stays quiet when only the first stats refresh fails", async () => {
		await start("/repo", { failingStatsOnly: true });
		// no toast on refresh failure; the footer keeps its initial zeros
		expect(toasts).toHaveLength(0);
	});
});
