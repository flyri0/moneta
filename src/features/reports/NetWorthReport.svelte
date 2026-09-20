<script lang="ts">
	import { AreaChart } from 'layerchart';
	import * as Chart from '$ui/chart';
	import NetWorthTooltip from './NetWorthTooltip.svelte';
	import ReportSection from './ReportSection.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { formatMonth, formatMonthLong } from '$i18n/formats';
	import {
		axisMonthLabel,
		isSingleMonth,
		netWorthChange,
		netWorthThrough,
		pointsInRange
	} from '$features/reports/net-worth';
	import type { DateRange } from '$features/reports/range';
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
	const points = $derived(pointsInRange(series.data ?? [], range, todayIso()));
	// A Date x gives the chart a time scale; the ticks are pinned to the months we actually have.
	const chartData = $derived(
		points.map((p) => ({
			...p,
			date: new Date(`${p.month}-01T00:00:00Z`),
			label: formatMonth(p.month, getLocale())
		}))
	);
	const stat = $derived(netWorthChange(points));
	const rows = $derived([...points].reverse());
	const shown = $derived(expanded ? rows : rows.slice(0, ROWS));

	const config = { netWorth: { label: m.reports_net_worth(), color: 'var(--chart-1)' } };
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

<ReportSection title={m.reports_net_worth()}>
	{#if series.error}
		<p class="text-sm text-destructive" role="alert">{errorMessage(series.error)}</p>
	{:else if series.data && points.length === 0}
		<p class="text-sm text-muted-foreground">{m.reports_net_worth_empty()}</p>
	{:else if stat}
		<StatTile
			value={session.format(stat.current)}
			{delta}
			caption={formatMonthLong(stat.to, getLocale())}
			testId="net-worth-current"
		/>

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

		<table class="w-full text-sm" data-testid="net-worth-table">
			<thead class="text-left text-xs text-muted-foreground">
				<tr>
					<th scope="col" class="py-1 font-medium">{m.reports_month()}</th>
					<th scope="col" class="hidden py-1 text-right font-medium md:table-cell">
						{m.reports_assets()}
					</th>
					<th scope="col" class="hidden py-1 text-right font-medium md:table-cell">
						{m.reports_debts()}
					</th>
					<th scope="col" class="py-1 text-right font-medium whitespace-nowrap">
						{m.reports_net_worth()}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as point (point.month)}
					<tr class="border-t">
						<td class="py-1.5 whitespace-nowrap">
							{formatMonth(point.month, getLocale())}
							<!-- On a phone there is no room for a column each, so assets and debts sit under
							the month and the net worth keeps the right edge. -->
							<span
								class="block text-xs whitespace-normal text-muted-foreground tabular-nums md:hidden"
							>
								{m.reports_assets()}
								{session.format(point.assets)} · {m.reports_debts()}
								{session.format(point.debts)}
							</span>
						</td>
						<td class="hidden py-1.5 text-right tabular-nums md:table-cell">
							{session.format(point.assets)}
						</td>
						<td class="hidden py-1.5 text-right tabular-nums md:table-cell">
							{session.format(point.debts)}
						</td>
						<td class="py-1.5 text-right font-medium whitespace-nowrap tabular-nums">
							{session.format(point.netWorth)}
						</td>
					</tr>
				{/each}
				{#if rows.length > ROWS}
					<tr class="border-t">
						<td colspan="4" class="py-2">
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
	{/if}
</ReportSection>
