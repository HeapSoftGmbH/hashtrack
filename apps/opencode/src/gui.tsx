/** @jsxImportSource solid-js */
import {
	Command,
	type MountedSession,
	Plugin,
	Slot,
	type Ui,
} from "@opencode/plugin/gui";
import { createEffect, onCleanup, Show } from "solid-js";
import favicon from "../../../packages/local-web/public/favicon.svg?raw";
import { hashtrackText } from "./format";
import { createStatsState } from "./gui-stats";
import { catalog } from "./i18n";
import { watchTurns } from "./refresh";
import { Hashtrack, type StatsResult } from "./rpc";

// Desktop can show the real favicon, so the label carries the text only
const faviconUrl = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

function Totals(props: {
	session: MountedSession;
	active: boolean;
	load(directory: string): Promise<StatsResult>;
	open(): void;
	tooltip: string;
	ui: Ui;
}) {
	const { stats, refresh } = createStatsState(
		(directory) => props.load(directory),
		() => props.session.directory || undefined,
	);

	createEffect(() => {
		void refresh(props.session.directory || undefined);
	});

	// mirror the TUI: a finished turn refreshes the repo totals, so the badge
	// does not lag behind until the session is routed again. Cached timelines
	// stay mounted while hidden, so only the visible one watches.
	createEffect(() => {
		if (!props.active) return;
		onCleanup(
			watchTurns(
				props.session.server.data,
				() => void refresh(props.session.directory || undefined),
			),
		);
	});

	const label = () => {
		const value = stats();
		return value ? hashtrackText(value.tokens, value.cost) : "";
	};

	return (
		<props.ui.Tooltip value={props.tooltip} placement="bottom">
			<props.ui.Button
				variant="ghost-muted"
				size="small"
				onClick={() => props.open()}
			>
				<Show when={stats()}>
					<img
						src={faviconUrl}
						alt=""
						style={{ width: "12px", height: "12px", display: "block" }}
					/>
					{label()}
				</Show>
			</props.ui.Button>
		</props.ui.Tooltip>
	);
}

export default Plugin.define({
	i18n: catalog,
	setup(ctx) {
		const load = async (directory: string): Promise<StatsResult> =>
			(await ctx.client.rpc(Hashtrack).stats({ directory })) as StatsResult;

		const openDashboard = async (directory?: string): Promise<void> => {
			try {
				const { url } = (await ctx.client
					.rpc(Hashtrack)
					.web(directory ? { directory } : {})) as { url: string };
				ctx.system.openExternal(url);
			} catch (error) {
				ctx.toast.show({
					title: "Hashtrack",
					description: ctx.t("openFailed", { error: String(error) }),
					variant: "error",
				});
			}
		};

		ctx.add(Command, () => ({
			id: "dashboard",
			title: ctx.t("commandTitle"),
			description: ctx.t("commandDescription"),
			group: "Hashtrack",
			keywords: "usage tokens cost hashtrack",
			slash: { name: "hashtrack" },
			run: () => openDashboard(ctx.sessions.current()?.directory),
		}));

		ctx.add(Slot, {
			at: "session.header",
			order: 10,
			render: (input) => (
				<Totals
					session={input.session}
					active={input.active}
					load={load}
					open={() => void openDashboard(input.session.directory)}
					tooltip={ctx.t("openDashboard")}
					ui={ctx.ui}
				/>
			),
		});
	},
});
