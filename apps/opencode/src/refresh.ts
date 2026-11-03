// same cadence as the TUI footer: a fallback for turns whose events we missed
export const REFRESH_MS = 10_000;

type TurnEvents = {
	on(
		type: "session.idle" | "session.execution.succeeded",
		handler: () => void,
	): () => void;
};

/** Refreshes when a turn ends, plus on a timer for events we missed. Returns the stop. */
export function watchTurns(data: TurnEvents, refresh: () => void): () => void {
	const stops = [
		data.on("session.idle", refresh),
		data.on("session.execution.succeeded", refresh),
	];
	const timer = setInterval(refresh, REFRESH_MS);
	return () => {
		for (const stop of stops) stop();
		clearInterval(timer);
	};
}
