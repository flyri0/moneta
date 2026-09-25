<script lang="ts">
	import CashFlowMini from './CashFlowMini.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import ReportCard from './ReportCard.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { todayIso } from '$domain/month';
	import { fillMonths, lastMonths, savingsRate } from '$features/reports/cash-flow';
	import { SPENDING_TABLES } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** What was left this month, over the last six months of income against expenses. */
	const session = useSession();
	const recent = lastMonths(todayIso(), 6);

	const flow = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.cashFlow(recent.range)
	);
	const rows = $derived(fillMonths(flow.data ?? [], recent.months));
	const current = $derived(rows.at(-1)!);
	const net = $derived(current.income - current.spending);
	const rate = $derived(savingsRate(rows));
	const percent = $derived(
		new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 })
	);
</script>

<ReportCard title={m.reports_cash_flow()} route="/reports/cash-flow" testId="cash-flow-card">
	{#if flow.error}
		<FormMessage error={actionError(flow.error)} />
	{:else if flow.data}
		<div class="flex items-end justify-between gap-3">
			<StatTile
				value={net > 0 ? `+${session.format(net)}` : session.format(net)}
				caption="{m.reports_net()} · {m.reports_range_this_month()}"
				testId="cash-flow-card-net"
			/>
			{#if rate !== null}
				<div class="grid gap-0.5 text-right">
					<span class="font-semibold tabular-nums">{percent.format(rate / 100)}</span>
					<span class="text-xs text-muted-foreground">{m.reports_savings_rate()}</span>
				</div>
			{/if}
		</div>
		<div class="flex min-h-0 flex-1 flex-col gap-2">
			<h3 class="text-xs text-muted-foreground">
				{m.reports_income_vs_expenses()} · {m.reports_range_last_6_months()}
			</h3>
			<CashFlowMini {rows} />
		</div>
	{/if}
</ReportCard>
