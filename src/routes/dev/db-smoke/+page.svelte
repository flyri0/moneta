<script lang="ts">
	// Diagnostic page used by the e2e smoke test: proves the worker, OPFS persistence and RPC work.
	import { onMount } from 'svelte';
	import { startDbWorker } from '$lib/client/db';

	let status = $state('starting');
	let accounts = $state<string[]>([]);

	onMount(async () => {
		const file = new URL(location.href).searchParams.get('file') ?? 'smoke.sqlite3';
		const { api } = startDbWorker();
		try {
			await api.system.open(file);
			if (!(await api.meta.isInitialized())) {
				await api.meta.init({ name: 'Smoke', currency: 'BRL', locale: 'pt-BR', groups: [] });
			}
			accounts = (await api.accounts.list()).map((a) => a.name);
			status = 'ready';
		} catch (err) {
			status = `error: ${err instanceof Error ? err.message : String(err)}`;
		}
		(window as unknown as { moneta: typeof api }).moneta = api;
	});
</script>

<p data-testid="status">{status}</p>
<ul>
	{#each accounts as name (name)}
		<li data-testid="account">{name}</li>
	{/each}
</ul>
