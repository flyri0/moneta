<script lang="ts">
	import type { Component } from 'svelte';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import XIcon from '@lucide/svelte/icons/x';
	import EmptyState from '$components/EmptyState.svelte';
	import { Button } from '$ui/button';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * An empty report. When the period or the flags may be what hides everything (`onClear`), it
	 * says so and offers to clear them, like the register; otherwise it shows the report's own text.
	 */
	let {
		icon,
		description,
		framed = false,
		onClear
	}: {
		icon: Component;
		description: string;
		framed?: boolean;
		onClear?: () => void;
	} = $props();
</script>

{#if onClear}
	<EmptyState {framed} icon={SearchXIcon} description={m.reports_no_results()}>
		<Button size="sm" variant="outline" onclick={onClear}>
			<XIcon />
			{m.register_clear_filters()}
		</Button>
	</EmptyState>
{:else}
	<EmptyState {framed} {icon} {description} />
{/if}
