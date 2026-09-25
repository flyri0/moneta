<script lang="ts">
	import { Tooltip } from 'layerchart';
	import { useSession } from '$client/app-state.svelte';
	import { segmentClass } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * A month's amount per series, in the same card as the other tooltips, top series first. The
	 * data row carries the month's `label` and, when `total` is set, its `total`.
	 */
	let {
		series,
		total = false
	}: {
		series: { key: string; label: string; color: number | null }[];
		total?: boolean;
	} = $props();

	const session = useSession();
</script>

<Tooltip.Root variant="none">
	{#snippet children({
		data
	}: {
		data: Record<string, number> & { label: string; total?: number };
	})}
		<div
			class="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
		>
			<div class="font-medium">{data.label}</div>
			<dl class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
				{#each series as s (s.key)}
					{#if data[s.key] > 0}
						<span class="size-2 rounded-full {segmentClass(s.color)}"></span>
						<dt class="max-w-36 truncate text-muted-foreground">{s.label}</dt>
						<dd class="text-right tabular-nums">{session.format(data[s.key])}</dd>
					{/if}
				{/each}
				{#if total && data.total !== undefined}
					<span></span>
					<dt class="text-muted-foreground">{m.reports_total()}</dt>
					<dd class="text-right font-medium tabular-nums">{session.format(data.total)}</dd>
				{/if}
			</dl>
		</div>
	{/snippet}
</Tooltip.Root>
