import type { AgentTurnRecord, Tool, Usage } from '@hashtrack/core';

export const usage = (tok = 0, cst = 0): Usage => ({
	in: 0,
	out: 0,
	cw: 0,
	cr: 0,
	tok,
	reason: 0,
	cst
});

export const tool = (name: string): Tool => ({ name, isError: false });

export const record = (
	overrides: Partial<AgentTurnRecord> & { turns: AgentTurnRecord['turns'] }
): AgentTurnRecord => ({
	t: new Date().toISOString(),
	sid: 's1',
	sn: 'Session 1',
	h: 'pi',
	mod: 'anthropic/claude-sonnet-4',
	rep: 'git@github.com:me/app.git',
	...overrides
});
