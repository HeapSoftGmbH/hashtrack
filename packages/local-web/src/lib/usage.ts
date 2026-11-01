import type { AgentTurnRecord } from '@hashtrack/core';

export const totalToolCount = (r: AgentTurnRecord) =>
	new Set(r.turns.flatMap((t) => t.tools.map((tool) => tool.name))).size;
export const totalTokens = (r: AgentTurnRecord) =>
	r.turns.reduce((n, t) => n + t.totalUsage.tok, 0);
export const totalCost = (r: AgentTurnRecord) => r.turns.reduce((n, t) => n + t.totalUsage.cst, 0);
export const totalSkillCount = (r: AgentTurnRecord) => new Set(r.skills ?? []).size;
