<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { Label } from '$ui/label';
	import { cn } from '$utils';

	/**
	 * One setting: its name on the left, its value or control on the right. With `onclick` the
	 * whole row is the button that opens the choice, and with `href` it is a link to another site
	 * that opens in a new tab; otherwise `control` sits inside the row.
	 */
	let {
		label,
		labelFor,
		hint,
		value,
		control,
		onclick,
		href,
		stacked = false,
		class: className
	}: {
		label: string;
		/** Set when `control` holds a single labelled input, so the name labels it. */
		labelFor?: string;
		hint?: string;
		value?: string;
		control?: Snippet;
		onclick?: () => void;
		/** An external URL. */
		href?: string;
		/** Puts the control under the name instead of beside it, for wide controls. */
		stacked?: boolean;
		class?: string;
	} = $props();

	const row = 'flex w-full items-center gap-3 px-4 py-3 text-left';
</script>

{#snippet name()}
	<div class="grid min-w-0 gap-0.5">
		{#if labelFor}
			<Label for={labelFor}>{label}</Label>
		{:else}
			<span class="text-sm font-medium">{label}</span>
		{/if}
		{#if hint}<span class="text-xs text-muted-foreground">{hint}</span>{/if}
	</div>
{/snippet}

{#if onclick}
	<button
		type="button"
		{onclick}
		class={cn(row, 'justify-between hover:bg-accent focus-visible:bg-accent', className)}
	>
		{@render name()}
		<span class="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
			{#if value}{value}{/if}
			{@render control?.()}
			<ChevronRightIcon class="size-4" />
		</span>
	</button>
{:else if href}
	<!-- An external page: resolve() only applies to the app's own routes. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		{href}
		target="_blank"
		rel="noopener noreferrer"
		class={cn(row, 'justify-between hover:bg-accent focus-visible:bg-accent', className)}
	>
		{@render name()}
		<span class="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
			{#if value}{value}{/if}
			<ExternalLinkIcon class="size-4" />
		</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else if stacked}
	<div class={cn('grid gap-2 px-4 py-3', className)}>
		{@render name()}
		{@render control?.()}
	</div>
{:else}
	<div class={cn(row, 'justify-between', className)}>
		{@render name()}
		<div class="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
			{#if value}<span>{value}</span>{/if}
			{@render control?.()}
		</div>
	</div>
{/if}
