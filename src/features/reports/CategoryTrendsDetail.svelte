<script lang="ts">
	import { BarChart } from 'layerchart';
	import * as Chart from '$ui/chart';
	import ReportSection from './ReportSection.svelte';
	import SeriesTooltip from './SeriesTooltip.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { formatMonth } from '$i18n/formats';
	import { axisMonthLabel } from '$features/reports/net-worth';
	import { type DateRange, reportMonths } from '$features/reports/range';
	import { segmentClass, SPENDING_TABLES } from '$features/reports/spending';
	import { categoryTrends } from '$features/reports/trends';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Spending month by month, stacked by the biggest categories, and every category's last month
	 * against its average over the period.
	 */
	let { range }: { range: DateRange } = $props();

	const session = useSession();
	/** Categories with a colour of their own in the chart; the rest stack as one. */
	const TOP = 5;
	/** Rows shown before the table folds, matching the other reports. */
	const ROWS = 8;

	let expanded = $state(false);

	const rows = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.categoryMonths({ from: range.from, to: range.to })
	);
	const months = $derived(
		reportMonths(
			range,
			todayIso(),
			(rows.data ?? []).map((r) => r.month)
		)
	);
	const trends = $derived(categoryTrends(rows.data ?? [], months, TOP));
	// Chart keys are positions, not ids: they become CSS variable names.
	const series = $derived(
		trends.series.map((s, i) => ({
			key: `s${i}`,
			label: s.label ?? m.reports_other(),
			color: s.color,
			values: s.values
		}))
	);
	const config = $derived(
		Object.fromEntries(
			series.map((s) => [
				s.key,
				{
					label: s.label,
					color: s.color ? `var(--cat-${s.color})` : 'var(--muted-foreground)'
				}
			])
		)
	);
	const data = $derived(
		months.map((month, i) => ({
			month,
			label: formatMonth(month, getLocale()),
			total: trends.totals[i],
			...Object.fromEntries(series.map((s) => [s.key, Math.max(0, s.values[i])]))
		}))
	);
	const last = $derived(months.at(-1));
	const table = $derived(
		trends.categories.map((c) => {
			const current = c.values.at(-1) ?? 0;
			return {
				...c,
				current,
				change: c.before ? (current - c.before) / c.before : null
			};
		})
	);
	const shown = $derived(expanded ? table : table.slice(0, ROWS));
	const colorOf = $derived(new Map(trends.series.map((s) => [s.key, s.color])));
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), {
			style: 'percent',
			maximumFractionDigits: 0,
			signDisplay: 'exceptZero'
		})
	);
</script>

{#if rows.error}
	<p class="text-sm text-destructive" role="alert">{errorMessage(rows.error)}</p>
{:else if rows.data && trends.categories.length === 0}
	<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
		{m.reports_spending_empty()}
	</p>
{:else if rows.data && last}
	<ReportSection title={m.reports_category_trends()}>
		{#snippet actions()}
			<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
				{#each series as s (s.key)}
					<li class="flex min-w-0 items-center gap-1.5">
						<span class="size-2.5 shrink-0 rounded-full {segmentClass(s.color)}" aria-hidden="true"
						></span>
						<span class="max-w-36 truncate">{s.label}</span>
					</li>
				{/each}
			</ul>
		{/snippet}
		<Chart.Container {config} class="aspect-auto h-64 w-full md:h-72" data-testid="trends-chart">
			<BarChart
				{data}
				x="month"
				series={series.map((s) => ({
					key: s.key,
					label: s.label,
					color: `var(--color-${s.key})`
				}))}
				seriesLayout="stack"
				bandPadding={0.3}
				padding={{ top: 8, right: 8, bottom: 34, left: 56 }}
				props={{
					bars: { radius: 0, strokeWidth: 0 },
					xAxis: {
						format: (month: string) => axisMonthLabel(month, month === months[0], getLocale()),
						tickLength: 10,
						tickOcclusion: { padding: 8 }
					},
					yAxis: {
						format: session.formatCompact,
						ticks: 4,
						tickLength: 0,
						tickLabelProps: { dx: -6 }
					}
				}}
			>
				{#snippet tooltip()}<SeriesTooltip series={[...series].reverse()} total />{/snippet}
			</BarChart>
		</Chart.Container>
	</ReportSection>

	<div class="rounded-xl border bg-card p-4 text-card-foreground">
		<table class="w-full text-sm" data-testid="trends-table">
			<thead class="text-left text-xs text-muted-foreground">
				<tr>
					<th scope="col" class="py-1 font-medium">{m.budget_category()}</th>
					<th scope="col" class="hidden py-1 text-right font-medium sm:table-cell">
						{m.reports_average_before()}
					</th>
					<th scope="col" class="py-1 pl-2 text-right font-medium whitespace-nowrap capitalize">
						{formatMonth(last, getLocale())}
					</th>
					<th scope="col" class="py-1 pl-2 text-right font-medium">{m.reports_change()}</th>
				</tr>
			</thead>
			<tbody class="tabular-nums">
				{#each shown as row (row.key)}
					<tr class="border-t">
						<th scope="row" class="py-1.5 pr-3 text-left font-normal">
							<span class="flex min-w-0 items-center gap-2">
								<span
									class="size-2.5 shrink-0 rounded-full {segmentClass(
										colorOf.get(row.key) ?? null
									)}"
									aria-hidden="true"
								></span>
								<span class="truncate">{row.label}</span>
							</span>
							<span class="block pl-4.5 text-xs text-muted-foreground sm:hidden">
								{m.reports_average_before()}
								{row.before === null ? '—' : session.format(row.before)}
							</span>
						</th>
						<td class="hidden py-1.5 text-right whitespace-nowrap sm:table-cell">
							{row.before === null ? '—' : session.format(row.before)}
						</td>
						<td class="py-1.5 pl-2 text-right whitespace-nowrap">{session.format(row.current)}</td>
						<td
							class="py-1.5 pl-2 text-right whitespace-nowrap {row.change !== null &&
							row.change > 0.1
								? 'text-red-700 dark:text-red-400'
								: row.change !== null && row.change < -0.1
									? 'text-emerald-700 dark:text-emerald-400'
									: 'text-muted-foreground'}"
						>
							{row.change === null ? '—' : percent.format(row.change)}
						</td>
					</tr>
				{/each}
				{#if table.length > ROWS}
					<tr class="border-t">
						<td colspan="4" class="py-2">
							<button
								type="button"
								class="text-sm text-muted-foreground hover:underline"
								aria-expanded={expanded}
								onclick={() => (expanded = !expanded)}
							>
								{expanded ? m.reports_show_less() : m.reports_show_all({ count: table.length })}
							</button>
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
{/if}
