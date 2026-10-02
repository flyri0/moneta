import {
	activeFilterCount,
	NO_FILTERS,
	type FilterValues,
	type StatusFilter
} from './register-filters';

/**
 * The register's search and filters, owned by the page so its header can hold the controls.
 * The typed search applies once typing pauses. Create it during component initialization.
 */
export class RegisterFilters implements FilterValues {
	/** What is typed in the search box. */
	searchInput = $state('');
	/** The search in effect: `searchInput`, a moment after the last keystroke. */
	search = $state('');
	/** The period, as `'YYYY-MM-DD'`; `''` leaves an end open. */
	from = $state('');
	to = $state('');
	/** `''` for any category or payee. */
	categoryId = $state('');
	payeeId = $state('');
	/** Bounds on the size of the amount, in minor units; `null` for none. */
	amountMin = $state<number | null>(null);
	amountMax = $state<number | null>(null);
	status = $state<StatusFilter>('');

	/** How many filters narrow the list (the period counts once); the search is apart. */
	activeCount = $derived(activeFilterCount(this));
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
		Object.assign(this, NO_FILTERS);
	}

	/** Back to no search and no filters, e.g. on another account. */
	clear() {
		this.searchInput = '';
		this.search = '';
		this.clearFilters();
	}
}
