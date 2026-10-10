<script lang="ts">
	import SearchFilterBar from '$components/SearchFilterBar.svelte';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { m } from '$i18n/paraglide/messages';
	import type { ScheduleFilters } from './filters.svelte';
	import ScheduleFilterDialog from './ScheduleFilterDialog.svelte';

	/**
	 * The schedules' search and Filters button, for the page header's toolbar. The filters' choices
	 * come from `schedules`, so each one matches something.
	 */
	let { filters, schedules }: { filters: ScheduleFilters; schedules: ScheduleRow[] } = $props();

	let open = $state(false);
</script>

<SearchFilterBar
	bind:search={filters.searchInput}
	placeholder={m.search_placeholder()}
	label={m.schedules_search()}
	activeCount={filters.activeCount}
	onFilters={() => (open = true)}
/>

<ScheduleFilterDialog bind:open {filters} {schedules} />
