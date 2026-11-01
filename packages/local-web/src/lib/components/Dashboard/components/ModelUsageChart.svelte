<script lang="ts">
	import { scaleLinear, scalePoint } from 'd3-scale';
	import { curveMonotoneX } from 'd3-shape';
	import { AreaChart, Tooltip, defaultChartPadding } from 'layerchart';
	import { compactNumberFormatter } from '@hashtrack/lib';
	import type { AgentTurnRecord } from '@hashtrack/core';

	import * as Chart from '$lib/components/ui/chart/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { records as store } from '$lib/stores/records.svelte.ts';
	import { getModelFromSourceString } from '$lib/utils';

	// ISO date "YYYY-MM-DD" → "Apr 14" for x axis label
	const formatDay = (d: string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

	// ISO date "YYYY-MM-DD" → "4/14/2025" for tooltip (timeZone UTC: keep the UTC wall-clock day, no local shift)
	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });

	let {
		value,
		format,
		records,
		range
	}: {
		value: (r: AgentTurnRecord) => number;
		format: (n: number) => string;
		records: AgentTurnRecord[];
		range: { start: string; end: string };
	} = $props();

	// series per model, ordered alphabetically by model name
	// only models with usage: an unused model would render as a flat zero line
	// records are pre-filtered to the date range by the caller
	const models = $derived.by(() => {
		const totals = records.reduce<Record<string, number>>((acc, r) => {
			acc[r.mod] = (acc[r.mod] ?? 0) + value(r);
			return acc;
		}, {});
		return Object.entries(totals)
			.sort((a, b) => {
				const la = getModelFromSourceString(a[0]);
				const lb = getModelFromSourceString(b[0]);
				return la.localeCompare(lb) || a[0].localeCompare(b[0]);
			})
			.map(([mod], i) => ({
				key: mod,
				label: getModelFromSourceString(mod),
				value: (d: { models: Record<string, number> }) => d.models[mod] ?? 0,
				color: `var(--chart-${(i % 5) + 1})`
			}));
	});

	const chartConfig = $derived(
		Object.fromEntries(
			models.map((m) => [m.key, { label: m.label, color: m.color }])
		) satisfies Chart.ChartConfig
	);

	// aggregate metric per calendar day (UTC, from ISO timestamp) per model, missing = 0
	// records are pre-filtered to the date range by the caller
	const data = $derived.by(() => {
		const byDay = records.reduce<Record<string, Record<string, number>>>((acc, r) => {
			const day = r.t.slice(0, 10);
			const dayCosts = acc[day] ?? {};
			dayCosts[r.mod] = (dayCosts[r.mod] ?? 0) + value(r);
			acc[day] = dayCosts;
			return acc;
		}, {});
		const days = Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000) + 1;
		return Array.from({ length: days }, (_, i) => {
			const date = new Date(Date.parse(range.start) + i * 86_400_000).toISOString().slice(0, 10);
			return { date, models: byDay[date] ?? {} };
		});
	});
</script>

{#if store.loaded}
	<Chart.Container config={chartConfig} class="h-75 w-full">
		<AreaChart
			{data}
			x="date"
			y="cost"
			series={models}
			yScale={scaleLinear()}
			xScale={scalePoint()}
			padding={defaultChartPadding({ left: 26, right: 20 })}
			props={{
				area: {
					curve: curveMonotoneX,
					fillOpacity: 0.3,
					motion: 'tween'
				},
				xAxis: { format: formatDay },
				yAxis: { format: (v) => (v < 1 ? '' : compactNumberFormatter.format(v)) }
			}}
		>
			{#snippet tooltip({ context })}
				{@const d = context.tooltip.data}
				<Tooltip.Root variant="none">
					<div
						class="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
					>
						{#if d}
							<div class="font-medium">{formatDate(d.date)}</div>
							<!-- own series list, not context.tooltip.series: layerchart reverses stacked
								 order (bottom-of-stack first), which would put the top model last -->
							{#each models as m (m.key)}
								<div class="flex w-full items-center gap-2">
									<div class="h-2.5 w-2.5 shrink-0 rounded-xs" style="background: {m.color}"></div>
									<span class="flex-1 text-muted-foreground">{m.label}</span>
									<span class="font-mono font-medium text-foreground tabular-nums">
										{format(d.models[m.key] ?? 0)}
									</span>
								</div>
							{/each}
						{/if}
					</div>
				</Tooltip.Root>
			{/snippet}
		</AreaChart>
	</Chart.Container>
{:else}
	<Skeleton class="h-75 w-full" />
{/if}
