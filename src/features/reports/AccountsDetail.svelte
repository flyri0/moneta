<script lang="ts">
	import { LineChart } from 'layerchart';
	import { resolve } from '$app/paths';
	import * as Chart from '$ui/chart';
	import ReportSection from './ReportSection.svelte';
	import SeriesTooltip from './SeriesTooltip.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { formatMonth } from '$i18n/formats';
	import { accountTypeLabel } from '$i18n/labels';
	import {
		accountBreakdown,
		debtProgress,
		type AccountSlice
	} from '$features/reports/accounts-breakdown';
	import { axisMonthLabel, netWorthThrough, pointsInRange } from '$features/reports/net-worth';
	import type { DateRange } from '$features/reports/range';
	import { segmentClass } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Today's assets and debts, account by account, and how each debt has moved over the period:
	 * its balance month by month and how much of it is paid off since it peaked.
	 */
	let { range }: { range: DateRange } = $props();

	const session = useSession();
	/** Debts with a line of their own in the chart. */
	const LINES = 5;

	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);
	const history = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.reports.accountBalances(netWorthThrough(range, todayIso()))
	);
	const breakdown = $derived(accountBreakdown(accounts.data ?? []));
	const points = $derived(pointsInRange(history.data ?? [], range, todayIso()));
	const charted = $derived(breakdown.debts.slice(0, LINES).map((d, i) => ({ ...d, key: `d${i}` })));
	const config = $derived(
		Object.fromEntries(
			charted.map((d, i) => [d.key, { label: d.name, color: `var(--cat-${i + 1})` }])
		)
	);
	const chartData = $derived(
		points.map((p) => ({
			date: new Date(`${p.month}-01T00:00:00Z`),
			month: p.month,
			label: formatMonth(p.month, getLocale()),
			...Object.fromEntries(charted.map((d) => [d.key, Math.max(0, -(p.balances[d.id] ?? 0))]))
		}))
	);
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 })
	);
	const sections = $derived([
		{
			key: 'assets',
			title: m.reports_assets(),
			total: breakdown.totalAssets,
			rows: breakdown.assets
		},
		{ key: 'debts', title: m.reports_debts(), total: breakdown.totalDebts, rows: breakdown.debts }
	]);
</script>

{#snippet accountRow(row: AccountSlice, i: number, total: number, debt: boolean)}
	{@const progress = debt ? debtProgress(points, row.id) : null}
	<tr class="border-t">
		<th scope="row" class="py-2 pr-3 text-left font-normal">
			<span class="grid gap-1.5">
				<span class="flex items-baseline justify-between gap-3">
					<a
						class="min-w-0 truncate font-medium hover:underline"
						href={resolve('/accounts/[id]', { id: row.id })}>{row.name}</a
					>
					<span class="shrink-0 text-xs text-muted-foreground">{accountTypeLabel(row.type)}</span>
				</span>
				<span class="block h-1.5 overflow-hidden rounded-full bg-muted">
					<span
						class="block h-full rounded-full {segmentClass(i < 5 ? i + 1 : null)}"
						style="width: {(row.amount / Math.max(1, total)) * 100}%"
					></span>
				</span>
				{#if progress && progress.paid > 0}
					<span class="text-xs text-emerald-700 dark:text-emerald-400">
						{m.reports_paid_off({ percent: percent.format(progress.paid) })}
					</span>
				{/if}
			</span>
		</th>
		<td class="py-2 text-right align-top whitespace-nowrap tabular-nums">
			{session.format(debt ? -row.amount : row.amount)}
		</td>
	</tr>
{/snippet}

{#if accounts.error || history.error}
	<p class="text-sm text-destructive" role="alert">
		{errorMessage(accounts.error ?? history.error)}
	</p>
{:else if accounts.data && breakdown.assets.length + breakdown.debts.length === 0}
	<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
		{m.reports_accounts_empty()}
	</p>
{:else if accounts.data}
	<div class="grid gap-4 lg:grid-cols-2 lg:items-start">
		{#each sections as section (section.key)}
			<ReportSection title={section.title}>
				{#snippet actions()}
					<span class="text-sm font-semibold tabular-nums">
						{session.format(section.key === 'debts' ? -section.total : section.total)}
					</span>
				{/snippet}
				{#if section.rows.length === 0}
					<p class="text-sm text-muted-foreground">
						{section.key === 'debts' ? m.reports_no_debts() : m.reports_accounts_empty()}
					</p>
				{:else}
					<table class="w-full text-sm" data-testid="accounts-{section.key}">
						<thead class="sr-only">
							<tr>
								<th scope="col">{m.reports_account()}</th>
								<th scope="col">{m.reports_total()}</th>
							</tr>
						</thead>
						<tbody>
							{#each section.rows as row, i (row.id)}
								{@render accountRow(row, i, section.total, section.key === 'debts')}
							{/each}
						</tbody>
					</table>
				{/if}
			</ReportSection>
		{/each}
	</div>

	{#if charted.length > 0 && chartData.length > 1}
		<ReportSection title={m.reports_debts_over_time()}>
			{#snippet actions()}
				<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
					{#each charted as d, i (d.key)}
						<li class="flex min-w-0 items-center gap-1.5">
							<span class="size-2.5 shrink-0 rounded-full {segmentClass(i + 1)}" aria-hidden="true"
							></span>
							<span class="max-w-36 truncate">{d.name}</span>
						</li>
					{/each}
				</ul>
			{/snippet}
			<Chart.Container {config} class="aspect-auto h-56 w-full md:h-64" data-testid="debts-chart">
				<LineChart
					data={chartData}
					x="date"
					series={charted.map((d) => ({
						key: d.key,
						label: d.name,
						color: `var(--color-${d.key})`
					}))}
					yDomain={[0, null]}
					padding={{ top: 8, right: 28, bottom: 34, left: 56 }}
					points={chartData.length <= 13}
					props={{
						spline: { strokeWidth: 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
						points: { r: 3, class: 'stroke-background', strokeWidth: 2 },
						xAxis: {
							ticks: chartData.map((d) => d.date),
							format: (d: Date) => {
								const month = d.toISOString().slice(0, 7);
								return axisMonthLabel(month, month === points[0]?.month, getLocale());
							},
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
					{#snippet tooltip()}
						<SeriesTooltip
							series={charted.map((d, i) => ({ key: d.key, label: d.name, color: i + 1 }))}
						/>
					{/snippet}
				</LineChart>
			</Chart.Container>
		</ReportSection>
	{/if}
{/if}
