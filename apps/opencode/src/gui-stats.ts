import { createSignal } from "solid-js";
import type { StatsResult } from "./rpc";

/**
 * Badge state for the Desktop footer.
 *
 * This is deliberately a plain signal, not `createResource`: refetching a
 * resource increments the nearest Suspense counter, and OpenCode Desktop wraps
 * the whole window in a Suspense boundary. Every poll would therefore swap the
 * entire window for its fallback. A signal only re-renders the badge.
 */
export function createStatsState(
	load: (directory: string) => Promise<StatsResult>,
	current: () => string | undefined,
) {
	const [stats, setStats] = createSignal<StatsResult | undefined>();
	// a failed refresh keeps the last total for the same directory, like the TUI
	let last: { directory: string; stats: StatsResult } | undefined;
	// overlapping refreshes (turn end, timer) must not let an older response win
	let seq = 0;

	const refresh = async (directory = current()) => {
		const id = ++seq;
		if (!directory) {
			setStats(undefined);
			return;
		}
		try {
			const next = await load(directory);
			if (id !== seq) return;
			// a response for a directory the user already left must not win
			if (directory !== current()) return;
			last = { directory, stats: next };
			setStats(next);
		} catch {
			if (id !== seq) return;
			// a failed refresh must not bring back a total from another directory
			setStats(
				directory === current() && last?.directory === directory
					? last.stats
					: undefined,
			);
		}
	};

	return { stats, refresh };
}
