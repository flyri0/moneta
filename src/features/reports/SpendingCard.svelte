<script lang="ts">
	import ReportCard from './ReportCard.svelte';
	import StackedBar from './StackedBar.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { presetRange } from '$features/reports/range';
	import { SPENDING_TABLES, segmentClass, topSegments } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** This month's spending at a glance: the total and where the biggest part of it went. */
	const session = useSession();
	const range = presetRange('this_month', todayIso());

	const spending = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.spending(range)
	);
	const top = $derived(topSegments(spending.data ?? []));
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 })
	);
</script>

<ReportCard title={m.reports_spending()} route="/reports/spending" testId="spending-card">
	{#if spending.error}
		<p class="text-sm text-destructive" role="alert">{errorMessage(spending.error)}</p>
	{:else if spending.data && top.total === 0}
		<p class="text-sm text-muted-foreground">{m.reports_spending_empty_month()}</p>
	{:else if top.total > 0}
		<StatTile
			value={session.format(top.total)}
			caption={m.reports_range_this_month()}
			testId="spending-card-total"
		/>
		<StackedBar segments={top.segments} other={top.other} class="h-3" />
		<ul class="grid gap-1.5 text-sm" data-testid="spending-card-legend">
			{#each top.segments as segment (segment.key)}
				<li class="grid grid-cols-[auto_1fr_auto_2.75rem] items-center gap-2">
					<span class="size-2.5 rounded-full {segmentClass(segment.color)}" aria-hidden="true"
					></span>
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
					<span class="min-w-0 truncate">
						{m.reports_more_categories({ count: top.other.count })}
					</span>
					<span class="tabular-nums">{session.format(top.other.amount)}</span>
					<span class="text-right text-xs tabular-nums">
						{percent.format(top.other.share / 100)}
					</span>
				</li>
			{/if}
		</ul>
	{/if}
</ReportCard>
