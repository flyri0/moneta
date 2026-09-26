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
	import { payeeSlices } from '$features/reports/payees';
	import { presetRange } from '$features/reports/range';
	import { SPENDING_TABLES, topSlices } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';

	/** This month's spending by who it went to: the total and the biggest payees. */
	const session = useSession();
	const range = presetRange('this_month', todayIso());

	const payees = useLive(session.client, SPENDING_TABLES, () => session.api.reports.payees(range));
	const top = $derived(topSlices(payeeSlices(payees.data ?? [])));
	const breakdown = (summary: string) => `${m.reports_payees()}: ${summary}`;
</script>

<ReportCard
	title={m.reports_payees()}
	route="/reports/payees"
	testId="payees-card"
	loading={!payees.data && !payees.error}
>
	{#if payees.error}
		<FormMessage error={actionError(payees.error)} />
	{:else if payees.data && top.total === 0}
		<p class="text-sm text-muted-foreground">{m.reports_spending_empty_month()}</p>
	{:else if top.total > 0}
		<StatTile
			value={session.format(top.total)}
			caption={m.reports_range_this_month()}
			testId="payees-card-total"
		/>
		<StackedBar segments={top.segments} other={top.other} label={breakdown} class="h-3" />
		<SegmentLegend
			{top}
			more={(count) => m.reports_more_payees({ count })}
			testId="payees-card-legend"
		/>
	{/if}
</ReportCard>
