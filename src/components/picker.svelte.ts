import { MediaQuery } from 'svelte/reactivity';

/**
 * Keeps a phone's keyboard out of a picker's way (below 768px): opening leaves focus on the list
 * instead of the search, so the keyboard comes up only when the search is tapped, and the row
 * creating what was typed goes right under the search instead of behind the keyboard. Bind `root`
 * to the picker's `Command.Root`.
 */
export class PickerKeyboard {
	#desktop = new MediaQuery('min-width: 768px');
	root = $state<HTMLElement | null>(null);

	/** Whether the row creating what was typed comes before the matches. */
	get createFirst(): boolean {
		return !this.#desktop.current;
	}

	/** For `Popover.Content`'s `onOpenAutoFocus`. */
	openAutoFocus = (event: Event) => {
		if (this.#desktop.current) return;
		event.preventDefault();
		this.dismiss();
	};

	/** Moves focus from the search to the list on phones, which puts the keyboard away. */
	dismiss() {
		if (!this.#desktop.current) this.root?.focus({ preventScroll: true });
	}
}
