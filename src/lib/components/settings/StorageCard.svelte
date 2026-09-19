<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { formatBytes } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let persisted = $state<boolean | null>(null);
	let estimate = $state<StorageEstimate | null>(null);

	async function refresh() {
		persisted = (await navigator.storage?.persisted?.()) ?? null;
		estimate = (await navigator.storage?.estimate?.()) ?? null;
	}

	async function ask() {
		await navigator.storage?.persist?.();
		await refresh();
	}

	onMount(() => void refresh());
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_storage()}</Card.Title>
	</Card.Header>
	<Card.Content class="grid gap-4 text-sm">
		{#if persisted !== null}
			<p data-testid="storage-persisted">
				{persisted ? m.storage_persisted() : m.storage_not_persisted()}
			</p>
			{#if !persisted}
				<Button variant="outline" class="justify-self-start" onclick={ask}>
					{m.storage_persist_ask()}
				</Button>
			{/if}
		{/if}
		{#if estimate?.usage !== undefined && estimate.quota !== undefined}
			<p>
				{m.storage_used({
					used: formatBytes(estimate.usage, getLocale()),
					quota: formatBytes(estimate.quota, getLocale())
				})}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
