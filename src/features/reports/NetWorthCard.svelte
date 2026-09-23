<script lang="ts">
	import CashFlowMini from './CashFlowMini.svelte';
	import ReportCard from './ReportCard.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { compareMonths, monthOf, todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { fillMonths, lastMonths } from '$features/reports/cash-flow';
	import { SPENDING_TABLES } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';

	/** Net worth today, over the last six months of income against expenses. */
	const session = useSession();
	const today = todayIso();
	const now = monthOf(today);
	const recent = lastMonths(today, 6);

	const series = useLive(session.client, ['transactions', 'accounts'], () =>
		session.api.reports.netWorth(now)
	);
	const flow = useLive(session.client, SPENDING_TABLES, () =>
		session.api.reports.cashFlow(recent.range)
	);
	// The series runs on past today when something is dated ahead; today's figure is the one wanted.
	const current = $derived(
		(series.data ?? []).filter((p) => compareMonths(p.month, now) <= 0).at(-1) ?? null
	);
	const rows = $derived(fillMonths(flow.data ?? [], recent.months));
</script>

<ReportCard title={m.reports_net_worth()} route="/reports/net-worth" testId="net-worth-card">
	{#if series.error || flow.error}
		<p class="text-sm text-destructive" role="alert">
			{errorMessage(series.error ?? flow.error)}
		</p>
	{:else if series.data && !current}
		<p class="text-sm text-muted-foreground">{m.reports_net_worth_empty()}</p>
	{:else if current}
		<StatTile
			value={session.format(current.netWorth)}
			caption={m.reports_today()}
			testId="net-worth-card-value"
		/>
		{#if flow.data}
			<div class="grid gap-2">
				<h3 class="text-xs text-muted-foreground">
					{m.reports_income_vs_expenses()} · {m.reports_range_last_6_months()}
				</h3>
				<CashFlowMini {rows} />
			</div>
		{/if}
	{/if}
</ReportCard>
