<script lang="ts">
	import Delayed from '$components/Delayed.svelte';
	import { Skeleton } from '$ui/skeleton';

	/**
	 * Placeholder rows while a list has no data yet: a label, a detail line and a figure per row.
	 * They show only once the wait has lasted `delay` ms (0 when a placeholder around them waits).
	 */
	let {
		rows = 6,
		delay = 150,
		class: className = ''
	}: { rows?: number; delay?: number; class?: string } = $props();

	/** Label widths, so the rows don't read as one repeated block. */
	const WIDTHS = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-2/5', 'w-1/4'];
</script>

<Delayed ms={delay}>
	<div
		class="animate-in divide-y fade-in {className}"
		aria-hidden="true"
		data-testid="loading-rows"
	>
		{#each { length: rows }, i (i)}
			<div class="flex items-center justify-between gap-4 px-4 py-3">
				<div class="grid flex-1 gap-2">
					<Skeleton class="h-4 {WIDTHS[i % WIDTHS.length]}" />
					<Skeleton class="h-3 w-1/5" />
				</div>
				<Skeleton class="h-4 w-16" />
			</div>
		{/each}
	</div>
</Delayed>
