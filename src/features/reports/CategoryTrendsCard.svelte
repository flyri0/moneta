<script lang="ts">
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
>
	{#if rows.error}
		<FormMessage error={actionError(rows.error)} />
	{:else if rows.data && trends.categories.length === 0}
		<p class="text-sm text-muted-foreground">{m.reports_spending_empty()}</p>
	{:else if rows.data}
		<StatTile
			value={session.format(trends.totals.at(-1) ?? 0)}
			caption="{m.reports_range_this_month()} · {m.reports_average_month({
				amount: session.format(trends.average)
			})}"
			testId="category-trends-card-total"
		/>
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
	{/if}
</ReportCard>
