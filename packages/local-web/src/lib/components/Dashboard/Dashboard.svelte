<script lang="ts">
	import {
		compactNumberFormatter,
		dollarNumberFormatter,
		dollarNumberFormatterWith4Fracts
	} from '@hashtrack/lib';

	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { records } from '$lib/stores/records.svelte.ts';
	import { totalCost, totalTokens } from '$lib/usage';
	import { getModelFromSourceString, isoDateNDaysAgo } from '$lib/utils';

	import { ModelUsageChart, NameCountChart } from './components';

	let range = $state({ start: isoDateNDaysAgo(6), end: isoDateNDaysAgo(0) });

	const filtered = $derived(
		records.data.filter((r) => {
			const day = r.t.slice(0, 10);
			return day >= range.start && day <= range.end;
		})
	);

	const countBy = (names: Iterable<string>): { name: string; count: number }[] => {
		const acc: Record<string, number> = {};
		for (const n of names) acc[n] = (acc[n] ?? 0) + 1;
		return Object.entries(acc)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);
	};

	const allTools = $derived(
		countBy(filtered.flatMap((r) => r.turns.flatMap((t) => t.tools.map((tool) => tool.name))))
	);

	const allModels = $derived(
		countBy(filtered.flatMap((r) => Array<string>(r.turns.length).fill(r.mod))).map((m) => ({
			...m,
			name: getModelFromSourceString(m.name)
		}))
	);

	const allSkills = $derived(countBy(filtered.flatMap((r) => r.skills ?? [])));

	const stats = $derived([
		{
			label: 'Cost',
			description: 'Total dollars spent in this repository.',
			value: dollarNumberFormatter.format(filtered.reduce((n, r) => n + totalCost(r), 0))
		},
		{
			label: 'Tokens Used',
			description: 'Total tokens used in this repository.',
			value: compactNumberFormatter.format(filtered.reduce((n, r) => n + totalTokens(r), 0))
		},
		{
			label: 'Tools Used',
			description: 'Number of distinct tools used.',
			value: compactNumberFormatter.format(allTools.length)
		},
		{
			label: 'Skills Used',
			description: 'Number of distinct skills used.',
			value: compactNumberFormatter.format(allSkills.length)
		}
	]);
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
	{#each stats as s (s.label)}
		<Card.Root>
			<Card.Header>
				<Card.Title>{s.label}</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if records.loaded}
					<div class="text-3xl tabular-nums -mt-4">{s.value}</div>
				{:else}
					<Skeleton class="h-9 w-28 -mt-4" />
				{/if}
				<div class="text-xs text-muted-foreground">{s.description}</div>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
<Card.Root class="mt-4">
	<Card.Header>
		<Card.Title>Model Costs</Card.Title>
		<Card.Description>Amount spent per model per day in dollars.</Card.Description>
		<Card.Action>
			<DateRangePicker bind:value={range} />
		</Card.Action>
	</Card.Header>
	<Card.Content>
		<ModelUsageChart
			value={totalCost}
			format={dollarNumberFormatterWith4Fracts.format}
			{range}
			records={filtered}
		/>
	</Card.Content>
</Card.Root>
<Card.Root class="mt-4">
	<Card.Header>
		<Card.Title>Tokens Used</Card.Title>
		<Card.Description>Total tokens used per model per day.</Card.Description>
	</Card.Header>
	<Card.Content>
		<ModelUsageChart
			value={totalTokens}
			format={compactNumberFormatter.format}
			{range}
			records={filtered}
		/>
	</Card.Content>
</Card.Root>
<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<NameCountChart
		title="Models"
		data={allModels}
		label="Invocations"
		description="Invocations per model across recorded turns."
	/>
	<NameCountChart
		title="Tools"
		data={allTools}
		label="Invocations"
		description="Runs per tool across recorded turns."
	/>
	<NameCountChart
		title="Skills"
		data={allSkills}
		label="Uses"
		description="Uses per skill across recorded turns."
	/>
</div>
