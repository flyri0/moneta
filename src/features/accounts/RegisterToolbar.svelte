<script lang="ts">
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import RegisterFilterDialog from '$features/accounts/RegisterFilterDialog.svelte';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The register's search and its Filters button, for the page header's toolbar. The filters
	 * (period, category, payee, amount, status) are set in a dialog; a dot on the button and a count
	 * show that some are in force.
	 */
	let { filters }: { filters: RegisterFilters } = $props();

	let open = $state(false);
</script>

<div class="flex gap-2">
	<div class="relative flex-1">
		<SearchIcon
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			type="search"
			bind:value={filters.searchInput}
			placeholder={m.register_search()}
			aria-label={m.register_search()}
			class="pl-9"
		/>
	</div>
	<Button variant="outline" class="relative" onclick={() => (open = true)}>
		<ListFilterIcon />
		{m.register_filters()}
		{#if filters.activeCount > 0}
			<span
				class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground"
				aria-label={m.register_filters_active({ count: filters.activeCount })}
			>
				{filters.activeCount}
			</span>
		{/if}
	</Button>
</div>

<RegisterFilterDialog bind:open {filters} />
