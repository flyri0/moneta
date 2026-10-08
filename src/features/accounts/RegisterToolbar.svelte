<script lang="ts">
	import SearchFilterBar from '$components/SearchFilterBar.svelte';
	import RegisterFilterDialog from '$features/accounts/RegisterFilterDialog.svelte';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The register's search and its Filters button, for the page header's toolbar. The filters
	 * (period, category, payee, amount, status, flags) are set in a dialog; a dot on the button and a count
	 * show that some are in force.
	 */
	let { filters }: { filters: RegisterFilters } = $props();

	let open = $state(false);
</script>

<SearchFilterBar
	bind:search={filters.searchInput}
	placeholder={m.register_search()}
	activeCount={filters.activeCount}
	onFilters={() => (open = true)}
/>

<RegisterFilterDialog bind:open {filters} />
