import { Rpc } from "@opencode/plugin/rpc";

const scope = {
	type: "object",
	properties: { directory: { type: "string" } },
	additionalProperties: false,
} as const;

const statsOutput = {
	type: "object",
	properties: {
		tokens: { type: "number" },
		cost: { type: "number" },
		sessions: { type: "number" },
		turns: { type: "number" },
		records: { type: "number" },
	},
	required: ["tokens", "cost", "sessions", "turns", "records"],
	additionalProperties: false,
} as const;

const webOutput = {
	type: "object",
	properties: { url: { type: "string" } },
	required: ["url"],
	additionalProperties: false,
} as const;

export interface StatsResult {
	tokens: number;
	cost: number;
	sessions: number;
	turns: number;
	records: number;
}

export interface WebResult {
	url: string;
}

/** Methods the witness server part exposes to the TUI, the desktop app, and any client. */
export const Witness = Rpc.define({
	id: "witness",
	methods: {
		stats: { input: scope, output: statsOutput },
		web: { input: scope, output: webOutput },
	},
	events: {},
});
