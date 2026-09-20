<script lang="ts">
	import ArrowDownRightIcon from '@lucide/svelte/icons/arrow-down-right';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';

	/**
	 * A headline figure: the value, an optional signed change, and a caption naming the moment
	 * it is measured at. The value carries no `tabular-nums`: equal-width digits make a number
	 * look loose at this size, and nothing lines up under it.
	 */
	let {
		value,
		delta,
		caption,
		testId
	}: {
		value: string;
		/** Signed money and its direction, or null when there is nothing to compare against. */
		delta?: { text: string; up: boolean } | null;
		caption?: string;
		testId?: string;
	} = $props();
</script>

<div class="grid gap-0.5">
	<span class="text-2xl leading-tight font-semibold" data-testid={testId}>{value}</span>
	{#if delta}
		<span
			class="flex items-center gap-1 text-xs font-medium {delta.up
				? 'text-emerald-700 dark:text-emerald-400'
				: 'text-red-700 dark:text-red-400'}"
		>
			{#if delta.up}
				<ArrowUpRightIcon class="size-3.5" aria-hidden="true" />
			{:else}
				<ArrowDownRightIcon class="size-3.5" aria-hidden="true" />
			{/if}
			{delta.text}
		</span>
	{/if}
	{#if caption}<span class="text-xs text-muted-foreground">{caption}</span>{/if}
</div>
