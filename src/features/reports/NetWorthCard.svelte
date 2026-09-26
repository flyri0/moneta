<script lang="ts">
	import ReportCard from './ReportCard.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import Sparkline from './Sparkline.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { monthOf, todayIso } from '$domain/month';
	import { formatMonth } from '$i18n/formats';
	import { netWorthChange, pointsInRange } from '$features/reports/net-worth';
	import { presetRange } from '$features/reports/range';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/** Net worth today, and where it has been over the last six months. */
	const session = useSession();
	const today = todayIso();
	const now = monthOf(today);

	const series = useLive(session.client, ['transactions', 'accounts'], () =>
		session.api.reports.netWorth(now)
	);
	// The series runs on past today when something is dated ahead; today's figure is the one wanted.
	const recent = $derived(
		pointsInRange(series.data ?? [], presetRange('last_6_months', today), today)
	);
	const current = $derived(recent.at(-1) ?? null);
	const stat = $derived(netWorthChange(recent));
	const delta = $derived(
		stat && stat.months > 1
			? {
					text: m.reports_change_since({
						amount:
							stat.change > 0 ? `+${session.format(stat.change)}` : session.format(stat.change),
						month: formatMonth(stat.from, getLocale())
					}),
					up: stat.change >= 0
				}
			: null
	);
</script>

<ReportCard
	title={m.reports_net_worth()}
	route="/reports/net-worth"
	testId="net-worth-card"
	loading={!series.data && !series.error}
>
	{#if series.error}
		<FormMessage error={actionError(series.error)} />
	{:else if series.data && !current}
		<p class="text-sm text-muted-foreground">{m.reports_net_worth_empty()}</p>
	{:else if current}
		<StatTile
			value={session.format(current.netWorth)}
			{delta}
			caption={m.reports_today()}
			testId="net-worth-card-value"
		/>
		{#if recent.length > 1}
			<Sparkline
				points={recent.map((p) => ({ month: p.month, value: p.netWorth }))}
				testId="net-worth-card-chart"
			/>
		{/if}
	{/if}
</ReportCard>
