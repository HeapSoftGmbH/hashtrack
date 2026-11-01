import type { AgentTurnRecord } from '@hashtrack/core';

export const records = $state<{ data: AgentTurnRecord[]; loaded: boolean }>({
	data: [],
	loaded: false
});
