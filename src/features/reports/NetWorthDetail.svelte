<script lang="ts">
	import { AreaChart } from 'layerchart';
	import * as Chart from '$ui/chart';
	import CashFlowChart from './CashFlowChart.svelte';
	import NetWorthTooltip from './NetWorthTooltip.svelte';
	import ReportSection from './ReportSection.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { formatMonth, formatMonthLong } from '$i18n/formats';
	import { fillMonths, savingsRate } from '$features/reports/cash-flow';
	import {
		axisMonthLabel,
		isSingleMonth,
		netWorthChange,
		netWorthThrough,
		pointsInRange
	} from '$features/reports/net-worth';
	import type { DateRange } from '$features/reports/range';
	import { SPENDING_TABLES } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	let { range }: { range: DateRange } = $props();

	const session = useSession();
	/** Rows shown before the table folds, matching the spending report. */
	const ROWS = 8;

	let expanded = $state(false);

	const series = useLive(session.client, ['transactions', 'accounts'], () =>
		session.api.reports.netWorth(netWorthThrough(range, todayIso()))
	);
	const flow = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.cashFlow({ from: range.from, to: range.to })
	);
	const points = $derived(pointsInRange(series.data ?? [], range, todayIso()));
	// Cash flow on the same months as net worth, so the chart and the table line up.
	const flows = $derived(
		fillMonths(
			flow.data ?? [],
			points.map((p) => p.month)
		)
	);
	const flowByMonth = $derived(new Map(flows.map((f) => [f.month, f])));
	const rate = $derived(savingsRate(flows));
	const last = $derived(points.at(-1));
	// A Date x gives the chart a time scale; the ticks are pinned to the months we actually have.
	const chartData = $derived(
		points.map((p) => ({
			...p,
			date: new Date(`${p.month}-01T00:00:00Z`),
			label: formatMonth(p.month, getLocale())
		}))
	);
	const stat = $derived(netWorthChange(points));
	const rows = $derived(
		[...points].reverse().map((p) => {
			const f = flowByMonth.get(p.month) ?? { income: 0, spending: 0 };
			return { ...p, income: f.income, spending: f.spending, net: f.income - f.spending };
		})
	);
	const shown = $derived(expanded ? rows : rows.slice(0, ROWS));

	const config = { netWorth: { label: m.reports_net_worth(), color: 'var(--chart-1)' } };
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
	const signed = (minor: number) =>
		minor > 0 ? `+${session.format(minor)}` : session.format(minor);
	const delta = $derived(
		stat && stat.months > 1
			? {
					text: m.reports_change_since({
						amount: signed(stat.change),
						month: formatMonth(stat.from, getLocale())
					}),
					up: stat.change >= 0
				}
			: null
	);
</script>

{#if series.error || flow.error}
	<p class="text-sm text-destructive" role="alert">{errorMessage(series.error ?? flow.error)}</p>
{:else if series.data && points.length === 0}
	<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
		{m.reports_net_worth_empty()}
	</p>
{:else if stat && last}
	<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
		<StatTile
			value={session.format(stat.current)}
			{delta}
			caption={formatMonthLong(stat.to, getLocale())}
			testId="net-worth-current"
		/>
		<dl class="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="net-worth-tiles">
			<div class="grid gap-0.5 rounded-lg bg-muted/60 px-3 py-2">
				<dt class="text-xs text-muted-foreground">{m.reports_assets()}</dt>
				<dd class="font-semibold break-words tabular-nums">{session.format(last.assets)}</dd>
			</div>
			<div class="grid gap-0.5 rounded-lg bg-muted/60 px-3 py-2">
				<dt class="text-xs text-muted-foreground">{m.reports_debts()}</dt>
				<dd class="font-semibold break-words tabular-nums">{session.format(last.debts)}</dd>
			</div>
			<div class="col-span-2 grid gap-0.5 rounded-lg bg-muted/60 px-3 py-2 sm:col-span-1">
				<dt class="text-xs text-muted-foreground">{m.reports_savings_rate()}</dt>
				<dd class="font-semibold tabular-nums" data-testid="savings-rate">
					{rate === null ? '—' : percent.format(rate / 100)}
				</dd>
			</div>
		</dl>
	</div>

	<div class="grid gap-4 lg:grid-cols-2 lg:items-start">
		<ReportSection title={m.reports_net_worth()}>
			{#if chartData.length > 1}
				<Chart.Container
					{config}
					class="aspect-auto h-56 w-full md:h-64"
					data-testid="net-worth-chart"
				>
					<AreaChart
						data={chartData}
						x="date"
						y="netWorth"
						series={[
							{ key: 'netWorth', label: config.netWorth.label, color: 'var(--color-netWorth)' }
						]}
						padding={{ top: 8, right: 28, bottom: 34, left: 56 }}
						points={chartData.length <= 13}
						props={{
							area: {
								fillOpacity: 0.1,
								line: { strokeWidth: 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
							},
							points: { r: 3.5, class: 'stroke-background', strokeWidth: 2 },
							xAxis: {
								ticks: chartData.map((d) => d.date),
								// Names only, so twelve months fit a phone; the tooltip and table say the year.
								format: (d: Date) => {
									const month = d.toISOString().slice(0, 7);
									return axisMonthLabel(month, month === points[0]?.month, getLocale());
								},
								// Enough drop to clear the y axis' own bottom label, which sits on the baseline.
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
						{#snippet tooltip()}<NetWorthTooltip />{/snippet}
					</AreaChart>
				</Chart.Container>
			{:else}
				<!-- One point means either the period is a single month, or the budget has only one
				month of history -- and telling someone to widen a period that is already wide is
				advice they cannot act on. -->
				<p class="text-sm text-muted-foreground">
					{isSingleMonth(range, todayIso())
						? m.reports_net_worth_single_month()
						: m.reports_net_worth_one_month()}
				</p>
			{/if}
		</ReportSection>

		<ReportSection title={m.reports_income_vs_expenses()}>
			<CashFlowChart rows={flows} />
		</ReportSection>
	</div>

	<div class="rounded-xl border bg-card p-4 text-card-foreground">
		<table class="w-full text-sm" data-testid="net-worth-table">
			<thead class="text-left text-xs text-muted-foreground">
				<tr>
					<th scope="col" class="py-1 font-medium">{m.reports_month()}</th>
					<th scope="col" class="hidden py-1 text-right font-medium md:table-cell">
						{m.reports_income()}
					</th>
					<th scope="col" class="hidden py-1 text-right font-medium md:table-cell">
						{m.reports_expenses()}
					</th>
					<th scope="col" class="hidden py-1 text-right font-medium md:table-cell">
						{m.reports_net()}
					</th>
					<th scope="col" class="py-1 text-right font-medium whitespace-nowrap">
						{m.reports_net_worth()}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as row (row.month)}
					<tr class="border-t">
						<td class="py-1.5 whitespace-nowrap">
							{formatMonth(row.month, getLocale())}
							<!-- On a phone there is no room for a column each, so the month's cash flow sits
							under it and the net worth keeps the right edge. -->
							<span
								class="block text-xs whitespace-normal text-muted-foreground tabular-nums md:hidden"
							>
								{m.reports_income()}
								{session.format(row.income)} · {m.reports_expenses()}
								{session.format(row.spending)}
							</span>
						</td>
						<td class="hidden py-1.5 text-right tabular-nums md:table-cell">
							{session.format(row.income)}
						</td>
						<td class="hidden py-1.5 text-right tabular-nums md:table-cell">
							{session.format(row.spending)}
						</td>
						<td
							class="hidden py-1.5 text-right tabular-nums md:table-cell {row.net < 0
								? 'text-red-700 dark:text-red-400'
								: ''}"
						>
							{signed(row.net)}
						</td>
						<td class="py-1.5 text-right font-medium whitespace-nowrap tabular-nums">
							{session.format(row.netWorth)}
						</td>
					</tr>
				{/each}
				{#if rows.length > ROWS}
					<tr class="border-t">
						<td colspan="5" class="py-2">
							<button
								type="button"
								class="text-sm text-muted-foreground hover:underline"
								aria-expanded={expanded}
								onclick={() => (expanded = !expanded)}
							>
								{expanded ? m.reports_show_less() : m.reports_show_all({ count: rows.length })}
							</button>
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
{/if}
