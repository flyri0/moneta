import { SvelteSet } from 'svelte/reactivity';

/**
 * The register's selection, owned by the page so its header can turn it on. While `active`, rows
 * show a checkbox and a bar at the bottom acts on the chosen ones.
 */
export class RegisterSelection {
	active = $state(false);
	readonly ids = new SvelteSet<string>();

	get count(): number {
		return this.ids.size;
	}

	has(id: string): boolean {
		return this.ids.has(id);
	}

	start(): void {
		this.active = true;
	}

	/** Leaves selection, forgetting what was chosen. */
	stop(): void {
		this.active = false;
		this.ids.clear();
	}

	toggle(id: string): void {
		if (this.ids.has(id)) this.ids.delete(id);
		else this.ids.add(id);
	}

	/** Chooses all of `ids`, or none of them when they all were already. */
	toggleAll(ids: string[]): void {
		if (ids.length > 0 && ids.every((id) => this.ids.has(id))) this.ids.clear();
		else for (const id of ids) this.ids.add(id);
	}

	/** Forgets chosen rows that are no longer listed (deleted, or filtered out). */
	keepOnly(ids: Iterable<string>): void {
		// A lookup for this call only, never read reactively.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const listed = new Set(ids);
		for (const id of [...this.ids]) if (!listed.has(id)) this.ids.delete(id);
	}
}
