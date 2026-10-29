/** @jsxImportSource solid-js */
import { Command, Plugin, Slot, type Ui } from "@opencode/plugin/gui";
import { createResource, Show } from "solid-js";
import favicon from "../../../packages/local-web/public/favicon.svg?raw";
import { witnessText } from "./format";
import { catalog } from "./i18n";
import { type StatsResult, Witness } from "./rpc";

// Desktop can show the real favicon, so the label carries the text only
const faviconUrl = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

function Totals(props: {
	session: { readonly directory: string };
	load(directory: string): Promise<StatsResult>;
	open(): void;
	tooltip: string;
	ui: Ui;
}) {
	const [stats] = createResource(
		() => props.session.directory || undefined,
		async (directory) => {
			try {
				return await props.load(directory);
			} catch {
				// the server part may not be ready yet: keep the badge empty
				return undefined;
			}
		},
	);
	const label = () => {
		const value = stats();
		return value ? witnessText(value.tokens, value.cost) : "";
	};

	// the slot keeps this component mounted while the user switches sessions;
	// createResource keyed on the directory drops responses for a directory
	// that is no longer the current one

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
			(await ctx.client.rpc(Witness).stats({ directory })) as StatsResult;

		const openDashboard = async (directory?: string): Promise<void> => {
			try {
				const { url } = (await ctx.client
					.rpc(Witness)
					.web(directory ? { directory } : {})) as { url: string };
				ctx.system.openExternal(url);
			} catch (error) {
				ctx.toast.show({
					title: "Witness",
					description: ctx.t("openFailed", { error: String(error) }),
					variant: "error",
				});
			}
		};

		ctx.add(Command, () => ({
			id: "dashboard",
			title: ctx.t("commandTitle"),
			description: ctx.t("commandDescription"),
			group: "Witness",
			keywords: "usage tokens cost witness",
			slash: { name: "witness" },
			run: () => openDashboard(ctx.sessions.current()?.directory),
		}));

		ctx.add(Slot, {
			at: "session.header",
			order: 10,
			render: (input) => (
				<Totals
					session={input.session}
					load={load}
					open={() => void openDashboard(input.session.directory)}
					tooltip={ctx.t("openDashboard")}
					ui={ctx.ui}
				/>
			),
		});
	},
});
