<script lang="ts">
	import { compactNumberFormatter, dollarNumberFormatterWith4Fracts } from '@hashtrack/lib';
	import {
		RiArrowDownLine,
		RiArrowRightSLine,
		RiArrowUpDownLine,
		RiArrowUpLine
	} from 'remixicon-svelte';

	import {
		type Column,
		type GroupingState,
		type Row,
		aggregationFn_first,
		aggregationFn_sum,
		columnFilteringFeature,
		columnGroupingFeature,
		columnVisibilityFeature,
		createColumnHelper,
		createExpandedRowModel,
		createFilteredRowModel,
		createGroupedRowModel,
		createSortedRowModel,
		createTable,
		createTableState,
		filterFn_includesString,
		rowAggregationFeature,
		rowExpandingFeature,
		rowSortingFeature,
		sortFn_alphanumeric,
		sortFn_text,
		tableFeatures
	} from '@tanstack/svelte-table';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { records } from '$lib/stores/records.svelte.ts';
	import { totalCost, totalSkillCount, totalTokens, totalToolCount } from '$lib/usage';
	import { cn, getModelFromSourceString, getProviderFromSourceString } from '$lib/utils.js';

	type UsageRow = {
		t: string;
		sid: string;
		b: string;
		h: string;
		hv?: string;
		mod: string;
		turns: number;
		tools: number;
		skills: number;
		tokens: number;
		cost: number;
	};

	const columnLabels: Record<string, string> = {
		t: 'Time',
		b: 'Branch',
		h: 'Harness',
		mod: 'Model',
		turns: 'Turns',
		tools: 'Tools',
		skills: 'Skills',
		tokens: 'Tokens',
		cost: 'Cost'
	};

	// Session name resolved per session id: any turn with a name, names the whole session.
	const sessionNames = $derived(
		new Map(records.data.filter((r) => r.sn).map((r) => [r.sid, r.sn] as const))
	);

	const rows = $derived(
		records.data
			.map((r) => ({
				t: r.t,
				sid: r.sid,
				b: r.branch ?? '',
				h: r.h,
				hv: r.hv,
				mod: r.mod,
				turns: r.turns.length,
				tools: totalToolCount(r),
				skills: totalSkillCount(r),
				tokens: totalTokens(r),
				cost: totalCost(r)
			}))
			.sort((a, b) => b.t.localeCompare(a.t))
	);

	const features = tableFeatures({
		columnFilteringFeature,
		columnGroupingFeature,
		columnVisibilityFeature,
		rowAggregationFeature,
		rowExpandingFeature,
		rowSortingFeature,
		groupedRowModel: createGroupedRowModel(),
		expandedRowModel: createExpandedRowModel(),
		filteredRowModel: createFilteredRowModel(),
		sortedRowModel: createSortedRowModel(),
		aggregationFns: { first: aggregationFn_first, sum: aggregationFn_sum },
		filterFns: { includesString: filterFn_includesString },
		sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text }
	});
	type Features = typeof features;

	const columnHelper = createColumnHelper<Features, UsageRow>();
	const columns = columnHelper.columns([
		columnHelper.accessor('t', { header: 'Time', aggregationFn: 'first' }),
		columnHelper.accessor('sid', { header: 'Session', enableSorting: false, enableHiding: false }),
		columnHelper.accessor('b', {
			header: 'Branch',
			enableSorting: false,
			filterFn: 'includesString'
		}),
		columnHelper.accessor('h', {
			header: 'Harness',
			enableSorting: false,
			filterFn: 'includesString'
		}),
		columnHelper.accessor('mod', { header: 'Model', enableSorting: false }),
		columnHelper.accessor((row) => getProviderFromSourceString(row.mod), {
			id: 'provider',
			enableSorting: false,
			enableGrouping: false,
			enableHiding: false,
			filterFn: 'includesString'
		}),
		columnHelper.accessor((row) => getModelFromSourceString(row.mod), {
			id: 'model',
			enableSorting: false,
			enableGrouping: false,
			enableHiding: false,
			filterFn: 'includesString'
		}),
		columnHelper.accessor('turns', { header: 'Turns', aggregationFn: 'sum' }),
		columnHelper.accessor('tools', { header: 'Tools', aggregationFn: 'sum' }),
		columnHelper.accessor('skills', { header: 'Skills', aggregationFn: 'sum' }),
		columnHelper.accessor('tokens', { header: 'Tokens', aggregationFn: 'sum' }),
		columnHelper.accessor('cost', { header: 'Cost', aggregationFn: 'sum' })
	]);

	const [grouping, setGrouping] = createTableState<GroupingState>(['sid']);

	let filters = $state<Record<'h' | 'provider' | 'model', string>>({
		h: '',
		provider: '',
		model: ''
	});

	const table = createTable({
		features,
		columns,
		get data() {
			return rows;
		},
		state: {
			get grouping() {
				return grouping();
			}
		},
		onGroupingChange: setGrouping
	});

	const hideableColumns = $derived(table.getAllColumns().filter((c) => c.getCanHide()));
	const visibleCount = $derived(hideableColumns.filter((c) => c.getIsVisible()).length);
	const columnsLabel = $derived(
		visibleCount === hideableColumns.length
			? 'All columns'
			: `${visibleCount} of ${hideableColumns.length} columns`
	);

	const uniqueValue = (row: Row<Features, UsageRow>, key: 'sid' | 'b' | 'h' | 'mod') => {
		const vals = [...new Set(row.subRows.map((r) => r.original[key]))];
		return vals.length === 1 ? vals[0] : '—';
	};

	const sessionLabel = (sid: string) => sessionNames.get(sid) ?? sid;
</script>

{#snippet sortIcon(column: Column<Features, UsageRow>)}
	{#if column.getIsSorted() === 'asc'}
		<RiArrowUpLine data-icon="inline-end" />
	{:else if column.getIsSorted() === 'desc'}
		<RiArrowDownLine data-icon="inline-end" />
	{:else}
		<RiArrowUpDownLine data-icon="inline-end" class="opacity-50" />
	{/if}
{/snippet}

{#snippet sortHeader(id: 't' | 'turns' | 'tools' | 'skills' | 'tokens' | 'cost', label: string)}
	{@const column = table.getColumn(id)}
	{#if column}
		<Button variant="ghost" size="sm" class="-mx-2" onclick={column.getToggleSortingHandler()}>
			{label}
			{@render sortIcon(column)}
		</Button>
	{/if}
{/snippet}

{#snippet groupCell(row: Row<Features, UsageRow>)}
	<button class="flex items-center gap-1.5 font-medium" onclick={row.getToggleExpandedHandler()}>
		<RiArrowRightSLine
			class={cn('size-4 shrink-0 transition-transform', row.getIsExpanded() && 'rotate-90')}
		/>
		{#if row.groupingColumnId === 'sid'}
			{sessionLabel(uniqueValue(row, 'sid'))}
		{:else}
			{String(row.getValue(row.groupingColumnId ?? ''))}
		{/if}
		<span class="font-normal text-muted-foreground">({row.subRows.length})</span>
	</button>
{/snippet}

{#snippet filterInput(key: 'h' | 'provider' | 'model', placeholder: string)}
	<Input
		{placeholder}
		value={filters[key]}
		oninput={(e) => {
			const v = e.currentTarget.value;
			filters[key] = v;
			table.getColumn(key)?.setFilterValue(v || undefined);
		}}
	/>
{/snippet}

<div class="flex items-center gap-6 mb-4">
	<div>
		<div class="text-sm text-muted-foreground mb-1">Group by:</div>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			value={grouping()[0] ?? ''}
			onValueChange={(v) => setGrouping(v ? [v] : [])}
		>
			<ToggleGroup.Item value="sid" class="w-22">Session</ToggleGroup.Item>
			<ToggleGroup.Item value="mod" class="w-22">Model</ToggleGroup.Item>
			<ToggleGroup.Item value="h" class="w-22">Harness</ToggleGroup.Item>
		</ToggleGroup.Root>
	</div>
	<div>
		<div class="text-sm text-muted-foreground mb-1">Columns:</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" class="w-35 justify-start" size="sm"
						>{columnsLabel}</Button
					>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)}
					<DropdownMenu.CheckboxItem
						bind:checked={() => column.getIsVisible(), (v) => column.toggleVisibility(!!v)}
					>
						{columnLabels[column.id] ?? column.id}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<div>
		<div class="text-sm text-muted-foreground mb-1">Filter:</div>
		<div class="flex gap-2">
			{@render filterInput('h', 'Harness…')}
			{@render filterInput('model', 'Model…')}
			{@render filterInput('provider', 'Provider…')}
		</div>
	</div>
</div>

<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head>Session</Table.Head>
			{#if table.getColumn('b')?.getIsVisible()}
				<Table.Head>Branch</Table.Head>
			{/if}
			{#if table.getColumn('t')?.getIsVisible()}
				<Table.Head>{@render sortHeader('t', 'Time')}</Table.Head>
			{/if}
			{#if table.getColumn('h')?.getIsVisible()}
				<Table.Head>Harness</Table.Head>
			{/if}
			{#if table.getColumn('mod')?.getIsVisible()}
				<Table.Head>Model</Table.Head>
			{/if}
			{#if table.getColumn('turns')?.getIsVisible()}
				<Table.Head class="text-right">{@render sortHeader('turns', 'Turns')}</Table.Head>
			{/if}
			{#if table.getColumn('tools')?.getIsVisible()}
				<Table.Head class="text-right">{@render sortHeader('tools', 'Tools')}</Table.Head>
			{/if}
			{#if table.getColumn('skills')?.getIsVisible()}
				<Table.Head class="text-right">{@render sortHeader('skills', 'Skills')}</Table.Head>
			{/if}
			{#if table.getColumn('tokens')?.getIsVisible()}
				<Table.Head class="text-right">{@render sortHeader('tokens', 'Tokens')}</Table.Head>
			{/if}
			{#if table.getColumn('cost')?.getIsVisible()}
				<Table.Head class="text-right">{@render sortHeader('cost', 'Cost')}</Table.Head>
			{/if}
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#if records.loaded}
			{#each table.getRowModel().rows as row (row.id)}
				{#if row.getIsGrouped()}
					<Table.Row>
						<Table.Cell class="font-mono text-xs overflow-hidden text-clip">
							{#if row.groupingColumnId === 'sid'}
								{@render groupCell(row)}
							{:else}
								{sessionLabel(uniqueValue(row, 'sid'))}
							{/if}
						</Table.Cell>
						{#if table.getColumn('b')?.getIsVisible()}
							<Table.Cell class="font-mono text-xs overflow-hidden text-clip">
								{uniqueValue(row, 'b') || '—'}
							</Table.Cell>
						{/if}
						{#if table.getColumn('t')?.getIsVisible()}
							<Table.Cell class="text-muted-foreground">
								{new Date(row.getValue('t') as string).toLocaleString()}
							</Table.Cell>
						{/if}
						{#if table.getColumn('h')?.getIsVisible()}
							<Table.Cell>
								{#if row.groupingColumnId === 'h'}
									{@render groupCell(row)}
								{:else}
									{uniqueValue(row, 'h')}
								{/if}
							</Table.Cell>
						{/if}
						{#if table.getColumn('mod')?.getIsVisible()}
							<Table.Cell>
								{#if row.groupingColumnId === 'mod'}
									{@render groupCell(row)}
								{:else}
									{uniqueValue(row, 'mod')}
								{/if}
							</Table.Cell>
						{/if}
						{#if table.getColumn('turns')?.getIsVisible()}
							<Table.Cell class="text-right font-medium">{row.getValue('turns')}</Table.Cell>
						{/if}
						{#if table.getColumn('tools')?.getIsVisible()}
							<Table.Cell class="text-right font-medium">{row.getValue('tools')}</Table.Cell>
						{/if}
						{#if table.getColumn('skills')?.getIsVisible()}
							<Table.Cell class="text-right font-medium">{row.getValue('skills')}</Table.Cell>
						{/if}
						{#if table.getColumn('tokens')?.getIsVisible()}
							<Table.Cell class="text-right font-medium">
								{compactNumberFormatter.format(row.getValue('tokens') as number)}
							</Table.Cell>
						{/if}
						{#if table.getColumn('cost')?.getIsVisible()}
							<Table.Cell class="text-right font-medium">
								{dollarNumberFormatterWith4Fracts.format(row.getValue('cost') as number)}
							</Table.Cell>
						{/if}
					</Table.Row>
				{:else}
					<Table.Row class="bg-accent">
						<Table.Cell class="font-mono text-xs overflow-hidden text-clip pl-8">
							{sessionLabel(row.original.sid)}
						</Table.Cell>
						{#if table.getColumn('b')?.getIsVisible()}
							<Table.Cell class="font-mono text-xs overflow-hidden text-clip">
								{row.original.b || '—'}
							</Table.Cell>
						{/if}
						{#if table.getColumn('t')?.getIsVisible()}
							<Table.Cell>{new Date(row.original.t).toLocaleString()}</Table.Cell>
						{/if}
						{#if table.getColumn('h')?.getIsVisible()}
							<Table.Cell>
								{row.original.h}
								{#if row.original.hv}
									<span class="text-muted-foreground"> v{row.original.hv}</span>
								{/if}
							</Table.Cell>
						{/if}
						{#if table.getColumn('mod')?.getIsVisible()}
							<Table.Cell>{row.original.mod}</Table.Cell>
						{/if}
						{#if table.getColumn('turns')?.getIsVisible()}
							<Table.Cell class="text-right">{row.original.turns}</Table.Cell>
						{/if}
						{#if table.getColumn('tools')?.getIsVisible()}
							<Table.Cell class="text-right">{row.original.tools}</Table.Cell>
						{/if}
						{#if table.getColumn('skills')?.getIsVisible()}
							<Table.Cell class="text-right">{row.original.skills}</Table.Cell>
						{/if}
						{#if table.getColumn('tokens')?.getIsVisible()}
							<Table.Cell class="text-right">
								{compactNumberFormatter.format(row.original.tokens)}
							</Table.Cell>
						{/if}
						{#if table.getColumn('cost')?.getIsVisible()}
							<Table.Cell class="text-right">
								{dollarNumberFormatterWith4Fracts.format(row.original.cost)}
							</Table.Cell>
						{/if}
					</Table.Row>
				{/if}
			{/each}
		{:else}
			{#each [0, 1, 2, 3, 4] as n (n)}
				<Table.Row>
					<Table.Cell class="font-mono text-xs"><Skeleton class="h-4 w-28" /></Table.Cell>
					<Table.Cell class="font-mono text-xs"><Skeleton class="h-4 w-16" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-36" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-14" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-48" /></Table.Cell>
					<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-8" /></Table.Cell>
					<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-8" /></Table.Cell>
					<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-8" /></Table.Cell>
					<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-12" /></Table.Cell>
					<Table.Cell class="text-right"><Skeleton class="ml-auto h-4 w-14" /></Table.Cell>
				</Table.Row>
			{/each}
		{/if}
	</Table.Body>
</Table.Root>
