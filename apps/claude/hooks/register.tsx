import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";
import type { NodeStatus, UsageSummary } from "../types";
import {
	compact,
	dollars,
	FAVICON,
	MARK,
	MARK_COLOR,
	repoLabel,
} from "./brand";

// The UI half of the plugin. It runs in Claude Code's UI engine (no Node), so
// it reads the numbers by running the recorder's own `node dist/hook.js totals`
// in the session's directory and keeps the result in `$.state`.

const PANE = "Hashtrack";
const FOOTER = "totals";

const summary = atom(
	{ plugin: "hashtrack", key: "summary" } as const,
	null as UsageSummary | null,
);

const node = atom(
	{ plugin: "hashtrack", key: "node" } as const,
	{ state: "unchecked" } as NodeStatus,
);

// The oldest Node.js dist/hook.js runs on (global fetch, AbortSignal.timeout)
const NODE_MIN_MAJOR = 18;
const NODE_URL = "https://nodejs.org";

function isSummary(value: unknown): value is UsageSummary {
	const v = value as Partial<UsageSummary> | null;
	return (
		typeof v?.repo?.tokens === "number" &&
		typeof v.repo.cost === "number" &&
		typeof v.session?.turns === "number" &&
		Array.isArray(v.models) &&
		Array.isArray(v.tools)
	);
}

/**
 * Looks for the Node.js the recorder runs on and stores what it found. The
 * hooks (hooks.json) fail without it, and nothing gets recorded, so the
 * footer and the pane say so instead of showing a total that never moves.
 */
async function checkNode($: EngineInterface): Promise<boolean> {
	let status: NodeStatus;
	try {
		const { exitCode, stdout } = await $.process.run(["node", "--version"], {
			timeoutMs: 10_000,
		});
		const version = stdout.trim();
		const major = Number(/^v(\d+)\./.exec(version)?.[1]);
		status =
			exitCode !== 0
				? { state: "missing" }
				: major >= NODE_MIN_MAJOR
					? { state: "ok" }
					: { state: "outdated", version };
	} catch {
		// `node` could not start: not installed, or not on the PATH
		status = { state: "missing" };
	}
	await update($, node, () => status);
	return status.state === "ok";
}

/** The Node.js check, then the totals if the recorder can run. */
async function checkAndRefresh($: EngineInterface): Promise<void> {
	if (await checkNode($)) await refresh($);
}

/** Reads the totals from the recorder and stores them; a failure keeps the last. */
async function refresh($: EngineInterface): Promise<void> {
	try {
		const sessionId = await $.session.id();
		const { exitCode, stdout } = await $.process.run(
			["node", `${$.plugin.root}/dist/hook.js`, "totals", sessionId],
			{ timeoutMs: 10_000 },
		);
		if (exitCode !== 0) return;

		const parsed: unknown = JSON.parse(stdout);
		if (isSummary(parsed)) await update($, summary, () => parsed);
	} catch {
		// tracking must never break the session: no Node, a bad line, a timeout
	}
}

function isBroken(
	status: NodeStatus,
): status is Extract<NodeStatus, { state: "missing" | "outdated" }> {
	return status.state === "missing" || status.state === "outdated";
}

function footerLabel(s: UsageSummary | null): string {
	if (!s) return "Hashtrack";
	return `${compact.format(s.repo.tokens)} · ${dollars.format(s.repo.cost)}`;
}

function openPane($: EngineInterface): void {
	void $.ui.open({ id: PANE, title: "Hashtrack", focus: true });
	// again here, so installing Node.js mid-session clears the warning
	void checkAndRefresh($);
}

export const register: Register = (on) => {
	on("session.start", async ($, e, next) => {
		await $.command.register({
			name: "hashtrack",
			description: "Show Hashtrack usage details",
		});
		void checkAndRefresh($);

		return next(e);
	});

	on("command.run", { command: "hashtrack" }, async ($) => {
		openPane($);

		return { text: "Hashtrack pane opened." };
	});

	// The Stop hook (hooks.json) records the turn; read the totals after it.
	// A throw here must not cost the recording: the catch runs the rest anyway.
	on("classic.Stop", async ($, e, next) => {
		const result = await next(e);
		void refresh($);

		return result;
	}).catch((_, e, next) => next(e));

	// The labels at the right of the prompt footer, replaced by the repo total
	// as a control that opens the pane (the engine's own labels are not drawn).
	on("ui.render", { component: "SessionMode" }, async ($, e) => {
		// Both reads at once: a read issued after an await in a render hook is
		// not taken as part of that render, and comes back without the value
		const [status, s] = await Promise.all([read($, node), read($, summary)]);
		const label = isBroken(status) ? "Hashtrack needs Node.js" : footerLabel(s);

		// A native Button on every surface: it holds only text, so the mark
		// takes the button's own color.
		const { Button } = $.ui.resolve(e);

		return (
			<Button key={FOOTER} onPress={() => openPane($)}>
				{`${MARK} ${label}`}
			</Button>
		);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const { Box, Link, Text } = $.ui.resolve(e);
		const [status, s] = await Promise.all([read($, node), read($, summary)]);

		if (isBroken(status)) {
			const found =
				status.state === "outdated"
					? `Found Node.js ${status.version}; Hashtrack needs ${NODE_MIN_MAJOR} or newer.`
					: "Node.js is not installed, or not on the PATH Claude Code runs with.";
			return (
				<Box flexDirection="column">
					<Text bold>Hashtrack is not recording</Text>
					<Text>
						Its hooks run on Node.js, so no usage is recorded in this session.
					</Text>
					<Text dimColor>{found}</Text>
					<Box flexDirection="row" marginTop={1}>
						<Text>Install Node.js {NODE_MIN_MAJOR} or newer from </Text>
						<Link href={NODE_URL}>{NODE_URL}</Link>
						<Text>, then restart Claude Code.</Text>
					</Box>
				</Box>
			);
		}

		if (!s) {
			return (
				<Text dimColor>
					No usage yet. Totals appear once a turn has been recorded.
				</Text>
			);
		}

		const heading = repoLabel(s.repo.tokens, s.repo.cost);

		// The terminal has no Svg: braille mark there, the favicon elsewhere
		let title: ReturnType<typeof Text>;
		if (e.surface === "terminal") {
			title = (
				<Text bold>
					<Text color={MARK_COLOR}>{MARK}</Text> {heading}
				</Text>
			);
		} else {
			const { Svg } = $.ui.resolve(e);
			title = (
				<Box flexDirection="row" alignItems="center" gap={1}>
					<Svg source={FAVICON} alt="Hashtrack" width={14} height={14} />
					<Text bold>{heading}</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column">
				{title}
				<Text dimColor>
					This session: {compact.format(s.session.tokens)} ·{" "}
					{dollars.format(s.session.cost)} · {s.session.turns} turns
				</Text>
				{s.models.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						<Text bold>By model</Text>
						{s.models.map((m) => (
							<Text key={`model:${m.name}`}>
								{m.name} {dollars.format(m.cost)}
							</Text>
						))}
					</Box>
				)}
				{s.tools.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						<Text bold>Top tools</Text>
						{s.tools.map((t) => (
							<Text key={`tool:${t.name}`}>
								{t.name} {t.calls} calls
								{t.errors > 0 ? `, ${t.errors} errors` : ""}
							</Text>
						))}
					</Box>
				)}
			</Box>
		);
	});
};
