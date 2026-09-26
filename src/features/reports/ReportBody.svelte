<script lang="ts">
	import type { Snippet } from 'svelte';
	import Delayed from '$components/Delayed.svelte';
	import { Skeleton } from '$ui/skeleton';

	/**
	 * A full report's content: placeholders until its data first arrives, then the report, dimmed
	 * while the figures for a new period are on their way.
	 */
	let { loading, stale, children }: { loading: boolean; stale: boolean; children: Snippet } =
		$props();
</script>

{#if loading}
	<Delayed>
		<div class="grid animate-in gap-4 fade-in" aria-hidden="true" data-testid="report-loading">
			<div class="grid gap-2 rounded-xl border bg-card p-4">
				<Skeleton class="h-7 w-40" />
				<Skeleton class="h-3 w-24" />
			</div>
			<div class="grid gap-4 rounded-xl border bg-card p-4">
				<Skeleton class="h-56 w-full md:h-64" />
			</div>
		</div>
	</Delayed>
{:else}
	<div
		class="grid gap-4 transition-opacity aria-busy:opacity-60 aria-busy:delay-150"
		aria-busy={stale}
	>
		{@render children()}
	</div>
{/if}
