<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One report: a section header over a card. The same grammar as Settings' `SettingsGroup`,
	 * but the body holds charts and tables rather than hairline-divided rows.
	 */
	let {
		title,
		description,
		actions,
		children
	}: { title: string; description?: string; actions?: Snippet; children: Snippet } = $props();
</script>

<section class="grid gap-1.5">
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
		<h2 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
		{@render actions?.()}
	</div>
	<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
		{@render children()}
	</div>
	{#if description}
		<p class="px-1 text-xs text-muted-foreground">{description}</p>
	{/if}
</section>
