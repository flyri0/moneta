<script lang="ts">
	import ReportBody from './ReportBody.svelte';
	import AgeOfMoneyChart from './AgeOfMoneyChart.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import ReportSection from './ReportSection.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import { formatMonth, formatMonthLong } from '$i18n/formats';
	import {
		AGE_OF_MONEY_TABLES,
		ageOfMoneyChange,
		ageOfMoneyInRange,
		daysLabel
	} from '$features/reports/age-of-money';
	import { isSingleMonth } from '$features/reports/net-worth';
	import type { DateRange } from '$features/reports/range';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	let { range }: { range: DateRange } = $props();

	const session = useSession();

	// The whole history is read whatever the period: each month's figure depends on every
	// inflow before it.
	const series = useLive(session.client, AGE_OF_MONEY_TABLES, () =>
		session.api.reports.ageOfMoney(todayIso())
	);
	const points = $derived(ageOfMoneyInRange(series.data ?? [], range, todayIso()));
	const stat = $derived(ageOfMoneyChange(points));
	const delta = $derived(
		stat && stat.months > 1
			? {
					text: m.reports_change_since({
						amount: `${stat.change > 0 ? '+' : ''}${daysLabel(stat.change)}`,
						month: formatMonth(stat.from, getLocale())
					}),
					up: stat.change >= 0
				}
			: null
	);
</script>

<ReportBody loading={!series.data && !series.error} stale={series.stale}>
	{#if series.error}
		<FormMessage error={actionError(series.error)} />
	{:else if series.data && !stat}
		<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
			{m.reports_age_of_money_not_enough()}
		</p>
	{:else if stat}
		<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
			<StatTile
				value={daysLabel(stat.current)}
				{delta}
				caption={formatMonthLong(stat.to, getLocale())}
				testId="age-of-money-current"
			/>
		</div>

		<ReportSection title={m.reports_age_of_money()} description={m.reports_age_of_money_about()}>
			{#if points.length > 1}
				<AgeOfMoneyChart {points} testId="age-of-money-chart" />
			{:else}
				<p class="text-sm text-muted-foreground">
					{isSingleMonth(range, todayIso())
						? m.reports_net_worth_single_month()
						: m.reports_net_worth_one_month()}
				</p>
			{/if}
		</ReportSection>
	{/if}
</ReportBody>
