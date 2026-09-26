<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Renders its content only once `ms` have passed: loading placeholders that a quick load never
	 * needs are then never built, laid out or seen flashing by. Give the content `animate-in fade-in`.
	 */
	let { ms = 150, children }: { ms?: number; children: Snippet } = $props();

	let shown = $state(false);
	$effect(() => {
		if (ms <= 0) {
			shown = true;
			return;
		}
		const timer = setTimeout(() => (shown = true), ms);
		return () => clearTimeout(timer);
	});
</script>

{#if shown}
	{@render children()}
{/if}
