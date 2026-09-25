<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';

	/**
	 * The top of every app page, placed before the page's column and stuck below the demo banner
	 * as the page scrolls: an optional way back, the title (text, or a snippet that renders its own
	 * `h1`), the page's actions, and a toolbar row for search and filters. Actions are `size="sm"`
	 * buttons with an icon and a label shown from `md:` up.
	 */
	let {
		title,
		subtitle,
		back,
		actions,
		toolbar,
		class: width = 'max-w-2xl lg:max-w-5xl'
	}: {
		title: string | Snippet;
		subtitle?: Snippet;
		/** The page one level up (a route without parameters), and its name. */
		back?: { route: '/accounts' | '/reports'; label: string };
		actions?: Snippet;
		toolbar?: Snippet;
		/** The max width of the page's column, so the header lines up with it. */
		class?: string;
	} = $props();
</script>

<header
	class="sticky top-[var(--app-top,0px)] z-30 border-b bg-background/95 backdrop-blur"
	data-scroll-inset="top"
	data-testid="page-header"
>
	<div class="mx-auto grid gap-3 px-3 py-3 md:px-6 {width}">
		{#if back}
			<a
				href={resolve(back.route)}
				class="-mb-2 inline-flex items-center gap-1 justify-self-start rounded-md py-0.5 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				<ChevronLeftIcon class="size-4" />
				<span>{back.label}</span>
			</a>
		{/if}
		<!-- The actions drop to their own line rather than squeeze a long title (e.g. the month). -->
		<div class="flex min-h-9 flex-wrap items-center justify-between gap-2">
			<div class="grid min-w-0 flex-[1_1_auto] gap-0.5">
				{#if typeof title === 'string'}
					<h1 class="truncate text-xl font-semibold tracking-tight">{title}</h1>
				{:else}
					{@render title()}
				{/if}
				{@render subtitle?.()}
			</div>
			{#if actions}
				<div class="ml-auto flex shrink-0 items-center gap-2">{@render actions()}</div>
			{/if}
		</div>
		{#if toolbar}{@render toolbar()}{/if}
	</div>
</header>
