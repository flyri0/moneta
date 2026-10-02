<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fab } from '$components/app/fab.svelte';

	/**
	 * The floating bar for a mode that works on the screen itself (choosing rows, reordering). It
	 * sits above the bottom navigation on phones and sticks to the bottom of the page from `md:` up.
	 * Mount it only while the mode is on: it hides the floating add button for as long as it lives.
	 * The bar lays itself out by its own width: it sits next to a resizable sidebar on desktops.
	 */
	let {
		label,
		testId,
		passThrough = false,
		children
	}: {
		label: string;
		testId?: string;
		/** Lets the pointer reach what is under the bar, e.g. while something is dragged past it. */
		passThrough?: boolean;
		children: Snippet;
	} = $props();

	// The floating add button would sit on the bar.
	$effect(() => {
		fab.hidden = true;
		return () => (fab.hidden = false);
	});
</script>

<div
	class="@container fixed inset-x-3 bottom-[calc(3.5rem+0.5rem+env(safe-area-inset-bottom))] z-40 rounded-xl border bg-background/95 shadow-lg backdrop-blur md:sticky md:inset-x-auto md:bottom-4 {passThrough
		? 'pointer-events-none'
		: ''}"
	role="toolbar"
	aria-label={label}
	data-testid={testId}
>
	{@render children()}
</div>
