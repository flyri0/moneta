<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { segmentClass, type TopSegments } from '$features/reports/spending';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** The stacked bar's key on a card: each coloured part, then the folded remainder. */
	let {
		top,
		more,
		testId
	}: {
		top: TopSegments;
		/** Names the remainder, e.g. "+3 more". */
		more: (count: number) => string;
		testId?: string;
	} = $props();

	const session = useSession();
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 })
	);
</script>

<ul class="grid gap-1.5 text-sm" data-testid={testId}>
	{#each top.segments as segment (segment.key)}
		<li class="grid grid-cols-[auto_1fr_auto_2.75rem] items-center gap-2">
			<span class="size-2.5 rounded-full {segmentClass(segment.color)}" aria-hidden="true"></span>
			<span class="min-w-0 truncate">{segment.label}</span>
			<span class="tabular-nums">{session.format(segment.amount)}</span>
			<span class="text-right text-xs text-muted-foreground tabular-nums">
				{percent.format(segment.share / 100)}
			</span>
		</li>
	{/each}
	{#if top.other}
		<li class="grid grid-cols-[auto_1fr_auto_2.75rem] items-center gap-2 text-muted-foreground">
			<span class="size-2.5 rounded-full {segmentClass(null)}" aria-hidden="true"></span>
			<span class="min-w-0 truncate">{more(top.other.count)}</span>
			<span class="tabular-nums">{session.format(top.other.amount)}</span>
			<span class="text-right text-xs tabular-nums">
				{percent.format(top.other.share / 100)}
			</span>
		</li>
	{/if}
</ul>
