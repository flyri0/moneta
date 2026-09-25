<script lang="ts">
	import CashFlowChart from './CashFlowChart.svelte';
	import CashFlowLegend from './CashFlowLegend.svelte';
	import NetFlowChart from './NetFlowChart.svelte';
	import ReportSection from './ReportSection.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { formatMonth } from '$i18n/formats';
	import { fillMonths, savingsRate } from '$features/reports/cash-flow';
	import { type DateRange, reportMonths } from '$features/reports/range';
	import { SPENDING_TABLES } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	let { range }: { range: DateRange } = $props();

	const session = useSession();
	/** Rows shown before the table folds, matching the other reports. */
	const ROWS = 8;

	let expanded = $state(false);

	const flow = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.cashFlow({ from: range.from, to: range.to })
	);
	const months = $derived(
		reportMonths(
			range,
			todayIso(),
			(flow.data ?? []).map((r) => r.month)
		)
	);
	const rows = $derived(fillMonths(flow.data ?? [], months));
	const income = $derived(rows.reduce((sum, r) => sum + r.income, 0));
	const spending = $derived(rows.reduce((sum, r) => sum + r.spending, 0));
	const rate = $derived(savingsRate(rows));
	const table = $derived(
		[...rows].reverse().map((r) => ({
			...r,
			net: r.income - r.spending,
			rate: savingsRate([r])
		}))
	);
	const shown = $derived(expanded ? table : table.slice(0, ROWS));

	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
	const signed = (minor: number) =>
		minor > 0 ? `+${session.format(minor)}` : session.format(minor);
	const tiles = $derived([
		{ key: 'income', label: m.reports_income(), value: session.format(income) },
		{ key: 'expenses', label: m.reports_expenses(), value: session.format(spending) },
		{ key: 'net', label: m.reports_net(), value: signed(income - spending) },
		{
			key: 'rate',
			label: m.reports_savings_rate(),
			value: rate === null ? '—' : percent.format(rate / 100)
		}
	]);
</script>

{#if flow.error}
	<p class="text-sm text-destructive" role="alert">{errorMessage(flow.error)}</p>
{:else if flow.data && (rows.length === 0 || (income === 0 && spending === 0))}
	<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
		{m.reports_income_expense_empty()}
	</p>
{:else if flow.data}
	<dl
		class="grid grid-cols-2 gap-2 rounded-xl border bg-card p-4 text-card-foreground sm:grid-cols-4"
		data-testid="cash-flow-tiles"
	>
		{#each tiles as tile (tile.key)}
			<div class="grid gap-0.5 rounded-lg bg-muted/60 px-3 py-2">
				<dt class="text-xs text-muted-foreground">{tile.label}</dt>
				<dd class="font-semibold break-words tabular-nums" data-testid="cash-flow-{tile.key}">
					{tile.value}
				</dd>
			</div>
		{/each}
	</dl>

	<div class="grid gap-4 lg:grid-cols-2 lg:items-start">
		<ReportSection title={m.reports_income_vs_expenses()}>
			{#snippet actions()}<CashFlowLegend />{/snippet}
			<CashFlowChart {rows} />
		</ReportSection>
		<ReportSection title={m.reports_net_per_month()}>
			<NetFlowChart {rows} />
		</ReportSection>
	</div>

	<div class="rounded-xl border bg-card p-4 text-card-foreground">
		<table class="w-full text-sm" data-testid="cash-flow-table">
			<thead class="text-left text-xs text-muted-foreground">
				<tr>
					<th scope="col" class="py-1 font-medium">{m.reports_month()}</th>
					<th scope="col" class="hidden py-1 text-right font-medium sm:table-cell">
						{m.reports_income()}
					</th>
					<th scope="col" class="hidden py-1 text-right font-medium sm:table-cell">
						{m.reports_expenses()}
					</th>
					<th scope="col" class="py-1 text-right font-medium">{m.reports_net()}</th>
					<th scope="col" class="py-1 pl-2 text-right font-medium whitespace-nowrap">
						{m.reports_savings_rate()}
					</th>
				</tr>
			</thead>
			<tbody class="tabular-nums">
				{#each shown as row (row.month)}
					<tr class="border-t">
						<td class="py-1.5 whitespace-nowrap">
							{formatMonth(row.month, getLocale())}
							<span class="block text-xs whitespace-normal text-muted-foreground sm:hidden">
								{m.reports_income()}
								{session.format(row.income)} · {m.reports_expenses()}
								{session.format(row.spending)}
							</span>
						</td>
						<td class="hidden py-1.5 text-right sm:table-cell">{session.format(row.income)}</td>
						<td class="hidden py-1.5 text-right sm:table-cell">{session.format(row.spending)}</td>
						<td
							class="py-1.5 text-right whitespace-nowrap {row.net < 0
								? 'text-red-700 dark:text-red-400'
								: ''}"
						>
							{signed(row.net)}
						</td>
						<td class="py-1.5 pl-2 text-right text-muted-foreground">
							{row.rate === null ? '—' : percent.format(row.rate / 100)}
						</td>
					</tr>
				{/each}
				{#if table.length > ROWS}
					<tr class="border-t">
						<td colspan="5" class="py-2">
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
