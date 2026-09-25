/**
 * The register's search and date range, owned by the page so its header can hold the controls.
 * The typed search applies once typing pauses. Create it during component initialization.
 */
export class RegisterFilters {
	/** What is typed in the search box. */
	searchInput = $state('');
	/** The search in effect: `searchInput`, a moment after the last keystroke. */
	search = $state('');
	from = $state('');
	to = $state('');

	constructor() {
		// Search as the user types, but not on every keystroke.
		$effect(() => {
			const text = this.searchInput;
			const timer = setTimeout(() => (this.search = text), 250);
			return () => clearTimeout(timer);
		});
	}

	/** Back to no search and no dates, e.g. on another account. */
	clear() {
		this.searchInput = '';
		this.search = '';
		this.from = '';
		this.to = '';
	}
}
