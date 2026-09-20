<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A titled block of settings rows: one card, rows divided by hairlines. */
	let { title, description, children }: { title: string; description?: string; children: Snippet } =
		$props();
</script>

<section class="grid gap-1.5">
	<h2 class="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
	<div class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground">
		{@render children()}
	</div>
	{#if description}
		<p class="px-1 text-xs text-muted-foreground">{description}</p>
	{/if}
</section>
