import { repoRoot, repoTally, type UsageTally } from "@hashtrack/core";

export interface RepoStats {
	tokens: number;
	cost: number;
	sessions: number;
	turns: number;
	records: number;
}

// core hands back the same tally while no log file changed
const cache = new WeakMap<UsageTally, RepoStats>();

/**
 * Totals for one repository, from every record in `.hashtrack`
 * (pending `usage.jsonl` plus archived `synced.jsonl`).
 *
 * The TUI polls this while it is open; core reads only what was appended
 * since the last call, and the result is the same object until then.
 */
export function repoStats(directory?: string): RepoStats {
	const tally = repoTally(repoRoot(directory));
	let stats = cache.get(tally);
	if (!stats) {
		stats = {
			tokens: tally.tokens,
			cost: tally.cost,
			sessions: tally.sessions.size,
			turns: tally.turns,
			records: tally.records,
		};
		cache.set(tally, stats);
	}
	return stats;
}
