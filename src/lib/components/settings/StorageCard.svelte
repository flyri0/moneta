<script lang="ts">
	import { onMount } from 'svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
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

<SettingsGroup title={m.settings_storage()}>
	{#if persisted !== null}
		<p class="px-4 py-3 text-sm text-muted-foreground" data-testid="storage-persisted">
			{persisted ? m.storage_persisted() : m.storage_not_persisted()}
		</p>
		{#if !persisted}
			<SettingsRow label={m.storage_persist_ask()} onclick={ask} />
		{/if}
	{/if}
	{#if estimate?.usage !== undefined && estimate.quota !== undefined}
		<p class="px-4 py-3 text-sm text-muted-foreground">
			{m.storage_used({
				used: formatBytes(estimate.usage, getLocale()),
				quota: formatBytes(estimate.quota, getLocale())
			})}
		</p>
	{/if}
</SettingsGroup>
