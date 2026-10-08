<script lang="ts">
	import type { Component } from 'svelte';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import XIcon from '@lucide/svelte/icons/x';
	import EmptyState from '$components/EmptyState.svelte';
	import { Button } from '$ui/button';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * An empty report. When the period may be what hides everything (`onShowAll`), it says so and
	 * offers all time, like the register's "Clear filters"; otherwise it shows the report's own text.
	 */
	let {
		icon,
		description,
		framed = false,
		onShowAll
	}: {
		icon: Component;
		description: string;
		framed?: boolean;
		onShowAll?: () => void;
	} = $props();
</script>

{#if onShowAll}
	<EmptyState {framed} icon={SearchXIcon} description={m.reports_no_results()}>
		<Button size="sm" variant="outline" onclick={onShowAll}>
			<XIcon />
			{m.reports_show_all_time()}
		</Button>
	</EmptyState>
{:else}
	<EmptyState {framed} {icon} {description} />
{/if}
