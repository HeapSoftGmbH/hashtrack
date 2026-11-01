/** @jsxImportSource @opentui/solid */

import { hashtrackColor, hashtrackMark } from "@hashtrack/lib";
import { Plugin } from "@opencode/plugin/tui";
import { hashtrackText } from "./format";
import { Hashtrack, type StatsResult } from "./rpc";
import { openInBrowser } from "./web";

const REFRESH_MS = 10_000;

// OpenTUI's span renders a text node that takes `fg`, but its props type omits it
const brandColor = { fg: hashtrackColor };

export default Plugin.define({
	id: "hashtrack.tui",
	async setup(context) {
		const directory = context.location?.directory;
		const [stats, updateStats] = context.storage.memory("repo", {
			initial: { tokens: 0, cost: 0, sessions: 0 },
		});

		const refresh = async () => {
			try {
				const result = (await context.client
					.rpc(Hashtrack)
					.stats(directory ? { directory } : {})) as StatsResult;
				updateStats((draft) => {
					draft.tokens = result.tokens;
					draft.cost = result.cost;
					draft.sessions = result.sessions;
				});
			} catch {
				// server unreachable or no records yet: keep the last known totals
			}
		};

		await refresh();

		const timer = setInterval(() => void refresh(), REFRESH_MS);
		const stopIdle = context.data.on("session.idle", () => void refresh());
		const stopDone = context.data.on(
			"session.execution.succeeded",
			() => void refresh(),
		);

		const slots = [
			context.ui.slot({
				append: "prompt.footer.status",
				render: () => (
					<text fg={context.theme.text.base}>
						<span {...brandColor}>{hashtrackMark}</span>{" "}
						{hashtrackText(stats.tokens, stats.cost)}
					</text>
				),
			}),
			context.ui.slot({
				append: "home.footer.status",
				render: () => (
					<text fg={context.theme.text.base}>
						<span {...brandColor}>{hashtrackMark}</span>{" "}
						{hashtrackText(stats.tokens, stats.cost)}
					</text>
				),
			}),
		];

		context.keymap.layer(() => ({
			mode: "global",
			priority: 10,
			commands: [
				{
					id: "hashtrack.dashboard",
					title: "Hashtrack: open dashboard",
					description: "Show detailed token and cost stats for this repository",
					group: "Hashtrack",
					palette: true,
					slash: { name: "hashtrack" },
					run: async () => {
						try {
							const result = (await context.client
								.rpc(Hashtrack)
								.web(directory ? { directory } : {})) as { url: string };
							openInBrowser(result.url);
							context.ui.toast.show({
								title: "Hashtrack",
								message: result.url,
								variant: "success",
							});
						} catch (error) {
							context.ui.toast.show({
								title: "Hashtrack",
								message: `Could not open the dashboard: ${String(error)}`,
								variant: "error",
							});
						}
					},
				},
			],
		}));

		return () => {
			clearInterval(timer);
			stopIdle();
			stopDone();
			for (const dispose of slots) dispose();
		};
	},
});
