<script lang="ts">
	import CardEmpty from './CardEmpty.svelte';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import ReportCard from './ReportCard.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import StatTile from './StatTile.svelte';
	import TrendsMini from './TrendsMini.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import { lastMonths } from '$features/reports/cash-flow';
	import { segmentClass, SPENDING_TABLES } from '$features/reports/spending';
	import { monthsWithSpending } from '$features/reports/card-state';
	import { categoryTrends } from '$features/reports/trends';
	import { m } from '$i18n/paraglide/messages';

	/** The last six months of spending, split by the biggest categories. */
	const session = useSession();
	const recent = lastMonths(todayIso(), 6);

	const rows = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.categoryMonths(recent.range)
	);
	const trends = $derived(categoryTrends(rows.data ?? [], recent.months, 4));
</script>

<ReportCard
	title={m.reports_category_trends()}
	route="/reports/category-trends"
	testId="category-trends-card"
	loading={!rows.data && !rows.error}
>
	{#if rows.error}
		<FormMessage error={actionError(rows.error)} />
	{:else if rows.data && trends.categories.length === 0}
		<CardEmpty icon={TrendingUpIcon} description={m.reports_spending_empty()} />
	{:else if rows.data}
		<StatTile
			value={session.format(trends.totals.at(-1) ?? 0)}
			caption="{m.reports_range_this_month()} · {m.reports_average_month({
				amount: session.format(trends.average)
			})}"
			testId="category-trends-card-total"
		/>
		{#if monthsWithSpending(trends.totals) > 1}
			<TrendsMini months={trends.months} series={trends.series} totals={trends.totals} />
			<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
				{#each trends.series as s (s.key)}
					<li class="flex min-w-0 items-center gap-1.5">
						<span class="size-2.5 shrink-0 rounded-full {segmentClass(s.color)}" aria-hidden="true"
						></span>
						<span class="max-w-32 truncate">{s.label ?? m.reports_other()}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-auto text-sm text-muted-foreground" data-testid="category-trends-card-note">
				{m.reports_trends_two_months()}
			</p>
		{/if}
	{/if}
</ReportCard>
