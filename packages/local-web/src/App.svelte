<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';

	import Dashboard from '$lib/components/Dashboard/Dashboard.svelte';
	import GitInfo from '$lib/components/GitInfo.svelte';
	import UsageTable from '$lib/components/UsageTable.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { records } from '$lib/stores/records.svelte.ts';

	import './app.css';

	onMount(async () => {
		// the viewer server scopes /api/records to a repository via ?dir=
		const dir = new URLSearchParams(location.search).get('dir');
		const query = dir ? `?dir=${encodeURIComponent(dir)}` : '';
		try {
			records.data.splice(0, records.data.length, ...(await (await fetch(`/api/records${query}`)).json()));
		} finally {
			records.loaded = true;
		}
	});
</script>

<ModeWatcher />

<main class="container mx-auto p-8">
	<Tabs.Root value="dashboard">
		<div class="flex gap-8 items-center mb-6">
			<div class="flex items-center gap-3">
				<img src="logo_charcoal.svg" alt="" class="h-6 w-auto dark:hidden" />
				<img src="logo_offwhite.svg" alt="" class="hidden h-6 w-auto dark:block" />
				<h1 class="text-2xl font-semibold">Witness</h1>
			</div>
			<Tabs.List>
				<Tabs.Trigger value="dashboard">Dashboard</Tabs.Trigger>
				<Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
			</Tabs.List>
			<GitInfo />
		</div>
		<Tabs.Content value="dashboard">
			<Dashboard />
		</Tabs.Content>
		<Tabs.Content value="sessions">
			<UsageTable />
		</Tabs.Content>
	</Tabs.Root>
</main>
