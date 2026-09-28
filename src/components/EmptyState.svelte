<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$utils';

	/**
	 * What a list, page or dialog shows when it has nothing to show: an icon, an optional title, why
	 * it's empty and, in `children`, the button for the next step. `framed` puts it in a card, for a
	 * page's own content.
	 */
	let {
		icon: Icon,
		title,
		description,
		framed = false,
		class: className,
		children
	}: {
		icon: Component;
		title?: string;
		description: string;
		framed?: boolean;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div
	class={cn(
		'grid justify-items-center gap-3 text-center',
		framed ? 'rounded-xl border bg-card p-8 text-card-foreground shadow-xs' : 'py-4',
		className
	)}
	data-testid="empty-state"
>
	<div class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
		<Icon class="size-6" aria-hidden="true" />
	</div>
	<div class="grid gap-1">
		{#if title}<p class="font-medium">{title}</p>{/if}
		<p class="max-w-xs text-sm text-muted-foreground">{description}</p>
	</div>
	{#if children}
		<div class="mt-1 flex flex-wrap justify-center gap-2">{@render children()}</div>
	{/if}
</div>
