<script lang="ts">
	import Delayed from '$components/Delayed.svelte';

	/**
	 * A thin bar across the top of the screen while it waits on a new page or its first data. It
	 * shows only once the wait lasts long enough to notice.
	 */
	let { busy }: { busy: boolean } = $props();
</script>

{#if busy}
	<Delayed>
		<div
			class="pointer-events-none fixed inset-x-0 top-[var(--app-top,0px)] z-50 h-0.5 animate-in overflow-hidden fade-in"
			aria-hidden="true"
			data-testid="loading-bar"
		>
			<div
				class="h-full w-2/5 animate-loading-bar bg-primary motion-reduce:w-full motion-reduce:animate-pulse"
			></div>
		</div>
	</Delayed>
{/if}
