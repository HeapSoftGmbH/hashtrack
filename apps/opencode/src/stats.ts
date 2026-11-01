import { statSync } from "node:fs";
import { join } from "node:path";
import {
	type AgentTurnRecord,
	readHashtrackRecords,
	repoRoot,
} from "@hashtrack/core";

export interface RepoStats {
	tokens: number;
	cost: number;
	sessions: number;
	turns: number;
	records: number;
}

interface CacheEntry {
	usage: string;
	synced: string;
	stats: RepoStats;
}

const cache = new Map<string, CacheEntry>();

/** File identity, so appends, archiving (tmp + rename) and truncation all invalidate. */
function stamp(file: string): string {
	try {
		const stat = statSync(file, { bigint: true });
		return `${stat.ino}:${stat.size}:${stat.mtimeNs}`;
	} catch {
		return "";
	}
}

function count(records: AgentTurnRecord[]): RepoStats {
	const sessions = new Set<string>();
	let tokens = 0;
	let cost = 0;
	let turns = 0;

	for (const record of records) {
		sessions.add(record.sid);
		for (const turn of record.turns ?? []) {
			tokens += Number(turn.totalUsage?.tok) || 0;
			cost += Number(turn.totalUsage?.cst) || 0;
			turns += 1;
		}
	}

	return {
		tokens,
		cost,
		sessions: sessions.size,
		turns,
		records: records.length,
	};
}

/**
 * Totals for one repository, from every record in `.hashtrack`
 * (pending `usage.jsonl` plus archived `synced.jsonl`).
 *
 * The TUI polls this while it is open, so the result is cached per repository
 * and only re-parsed when one of the files changed.
 */
export function repoStats(directory?: string): RepoStats {
	const root = repoRoot(directory);
	const usage = stamp(join(root, ".hashtrack", "usage.jsonl"));
	const synced = stamp(join(root, ".hashtrack", "synced.jsonl"));
	const hit = cache.get(root);
	if (hit && hit.usage === usage && hit.synced === synced) return hit.stats;

	const stats = count(readHashtrackRecords(root));
	cache.set(root, { usage, synced, stats });
	return stats;
}
