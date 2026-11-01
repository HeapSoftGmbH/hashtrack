import { mount } from 'svelte';
import { describe, expect, test } from 'vitest';
import type { AgentTurnRecord } from '@hashtrack/core';

import { records } from '$lib/stores/records.svelte.ts';

import { record, tool, usage } from '../../../../test/fixtures';
import ModelUsageChart from './ModelUsageChart.svelte';

const awaitTick = () => new Promise((r) => setTimeout(r, 0));

const lastWeekRange = () => {
	const end = new Date();
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - 6);
	return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

const mountChart = (target: HTMLElement) => {
	const range = lastWeekRange();
	mount(ModelUsageChart, {
		target,
		props: {
			value: (r: AgentTurnRecord) => r.turns[0].totalUsage.tok,
			format: (n: number) => String(n),
			records: records.data.filter((r) => {
				const day = r.t.slice(0, 10);
				return day >= range.start && day <= range.end;
			}),
			range
		}
	});
};

describe('ModelUsageChart', () => {
	test('mounts and renders an svg for a single record', async () => {
		records.data.push(
			record({
				mod: 'anthropic/claude-sonnet-4',
				turns: [{ ti: 0, tools: [tool('read')], totalUsage: usage(1000, 1) }]
			})
		);

		records.loaded = true;

		const target = document.createElement('div');
		mountChart(target);

		// chart draws after the ResizeObserver reports a size (stubbed in setup)
		await awaitTick();
		expect(target.querySelector('svg')).toBeTruthy();
	});

	test('only includes models used inside the 7-day window', async () => {
		const now = new Date();
		const old = new Date(now);
		old.setUTCDate(old.getUTCDate() - 8);
		records.data.push(
			record({
				mod: 'anthropic/claude-opus-4',
				t: old.toISOString(),
				turns: [{ ti: 0, tools: [tool('read')], totalUsage: usage(1000, 1) }]
			}),
			record({
				mod: 'anthropic/claude-sonnet-4',
				t: now.toISOString(),
				turns: [{ ti: 0, tools: [tool('read')], totalUsage: usage(1000, 1) }]
			})
		);

		records.loaded = true;

		const target = document.createElement('div');
		mountChart(target);

		await awaitTick();
		expect(target.querySelectorAll('.lc-area-path').length).toBe(1);
	});
});
