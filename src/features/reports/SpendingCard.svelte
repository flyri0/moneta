<script lang="ts">
	import ReportCard from './ReportCard.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import SegmentLegend from './SegmentLegend.svelte';
	import StackedBar from './StackedBar.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import { presetRange } from '$features/reports/range';
	import { SPENDING_TABLES, topSegments } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';

	/** This month's spending at a glance: the total and where the biggest part of it went. */
	const session = useSession();
	const range = presetRange('this_month', todayIso());

	const spending = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.spending(range)
	);
	const top = $derived(topSegments(spending.data ?? []));
</script>

<ReportCard title={m.reports_spending()} route="/reports/spending" testId="spending-card">
	{#if spending.error}
		<FormMessage error={actionError(spending.error)} />
	{:else if spending.data && top.total === 0}
		<p class="text-sm text-muted-foreground">{m.reports_spending_empty_month()}</p>
	{:else if top.total > 0}
		<StatTile
			value={session.format(top.total)}
			caption={m.reports_range_this_month()}
			testId="spending-card-total"
		/>
		<StackedBar segments={top.segments} other={top.other} class="h-3" />
		<SegmentLegend
			{top}
			more={(count) => m.reports_more_categories({ count })}
			testId="spending-card-legend"
		/>
	{/if}
</ReportCard>
