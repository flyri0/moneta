<script lang="ts">
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * A search box and a Filters button, for a page header's toolbar. A count on the button shows
	 * how many filters are in force; the button calls `onFilters`, which opens them.
	 */
	let {
		search = $bindable(),
		placeholder,
		label,
		activeCount,
		onFilters
	}: {
		search: string;
		/** The visible hint. */
		placeholder: string;
		/** The accessible name. */
		label: string;
		activeCount: number;
		onFilters: () => void;
	} = $props();
</script>

<div class="flex gap-2">
	<div class="relative flex-1">
		<SearchIcon
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input type="search" bind:value={search} {placeholder} aria-label={label} class="pl-9" />
	</div>
	<Button variant="outline" class="relative" onclick={onFilters}>
		<ListFilterIcon />
		{m.register_filters()}
		{#if activeCount > 0}
			<span
				class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground"
				aria-label={m.register_filters_active({ count: activeCount })}
			>
				{activeCount}
			</span>
		{/if}
	</Button>
</div>
