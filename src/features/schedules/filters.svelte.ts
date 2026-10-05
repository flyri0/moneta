import {
	activeScheduleFilterCount,
	NO_SCHEDULE_FILTERS,
	type ScheduleFilterValues,
	type ScheduleKindFilter,
	type ScheduleStatusFilter
} from './filters';

/**
 * The schedules screen's search and filters, owned by the page so its header can hold the
 * controls. The typed search applies once typing pauses. Create it during component initialization.
 */
export class ScheduleFilters implements ScheduleFilterValues {
	/** What is typed in the search box. */
	searchInput = $state('');
	/** The search in effect: `searchInput`, a moment after the last keystroke. */
	search = $state('');
	from = $state('');
	to = $state('');
	accountId = $state('');
	categoryId = $state('');
	payeeId = $state('');
	amountMin = $state<number | null>(null);
	amountMax = $state<number | null>(null);
	status = $state<ScheduleStatusFilter>('');
	kind = $state<ScheduleKindFilter>('');

	/** How many filters narrow the list (the period counts once); the search is apart. */
	activeCount = $derived(activeScheduleFilterCount(this));
	/** Whether the search or any filter narrows the list. */
	active = $derived(!!this.search || this.activeCount > 0);

	constructor() {
		// Search as the user types, but not on every keystroke.
		$effect(() => {
			const text = this.searchInput;
			const timer = setTimeout(() => (this.search = text), 250);
			return () => clearTimeout(timer);
		});
	}

	/** Back to no filters, keeping the search. */
	clearFilters() {
		Object.assign(this, NO_SCHEDULE_FILTERS);
	}

	/** Back to no search and no filters. */
	clear() {
		this.searchInput = '';
		this.search = '';
		this.clearFilters();
	}
}
