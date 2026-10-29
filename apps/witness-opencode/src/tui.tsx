/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { witnessColor, witnessMark } from "lib";
import { witnessText } from "./format";
import { type StatsResult, Witness } from "./rpc";
import { openInBrowser } from "./web";

const REFRESH_MS = 10_000;

// OpenTUI's span renders a text node that takes `fg`, but its props type omits it
const brandColor = { fg: witnessColor };

export default Plugin.define({
	id: "witness.tui",
	async setup(context) {
		const directory = context.location?.directory;
		const [stats, updateStats] = context.storage.memory("repo", {
			initial: { tokens: 0, cost: 0, sessions: 0 },
		});

		const refresh = async () => {
			try {
				const result = (await context.client
					.rpc(Witness)
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
						<span {...brandColor}>{witnessMark}</span>{" "}
						{witnessText(stats.tokens, stats.cost)}
					</text>
				),
			}),
			context.ui.slot({
				append: "home.footer.status",
				render: () => (
					<text fg={context.theme.text.base}>
						<span {...brandColor}>{witnessMark}</span>{" "}
						{witnessText(stats.tokens, stats.cost)}
					</text>
				),
			}),
		];

		context.keymap.layer(() => ({
			mode: "global",
			priority: 10,
			commands: [
				{
					id: "witness.dashboard",
					title: "Witness: open dashboard",
					description: "Show detailed token and cost stats for this repository",
					group: "Witness",
					palette: true,
					slash: { name: "witness" },
					run: async () => {
						try {
							const result = (await context.client
								.rpc(Witness)
								.web(directory ? { directory } : {})) as { url: string };
							openInBrowser(result.url);
							context.ui.toast.show({
								title: "Witness",
								message: result.url,
								variant: "success",
							});
						} catch (error) {
							context.ui.toast.show({
								title: "Witness",
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
