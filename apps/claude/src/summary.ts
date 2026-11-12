import { emptyTotals, type UsageTally } from "@hashtrack/core";
import type { UsageSummary } from "../types";

export type { UsageSummary };

const TOP = 5;

/**
 * Ranks a repo's tally for display. `sessionId` picks the session line;
 * models and tools cover the whole repo.
 */
export function usageSummary(
	tally: UsageTally,
	sessionId?: string,
): UsageSummary {
	const session = (sessionId && tally.sessions.get(sessionId)) || emptyTotals();

	return {
		repo: { tokens: tally.tokens, cost: tally.cost },
		session: { ...session },
		models: [...tally.models]
			.map(([name, cost]) => ({ name, cost }))
			.sort((a, b) => b.cost - a.cost)
			.slice(0, TOP),
		tools: [...tally.tools]
			.map(([name, t]) => ({ name, ...t }))
			.sort((a, b) => b.calls - a.calls)
			.slice(0, TOP),
	};
}
