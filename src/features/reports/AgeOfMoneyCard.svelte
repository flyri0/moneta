<script lang="ts">
	import AgeOfMoneyChart from './AgeOfMoneyChart.svelte';
	import ReportCard from './ReportCard.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import { formatMonth } from '$i18n/formats';
	import {
		AGE_OF_MONEY_TABLES,
		ageOfMoneyChange,
		ageOfMoneyInRange,
		daysLabel
	} from '$features/reports/age-of-money';
	import { presetRange } from '$features/reports/range';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * Today's Age of Money, how it moved over the last six months, the curve of those months and
	 * their low and high, like YNAB's card.
	 */
	const session = useSession();
	const today = todayIso();

	const series = useLive(session.client, AGE_OF_MONEY_TABLES, () =>
		session.api.reports.ageOfMoney(today)
	);
	const current = $derived(series.data?.at(-1)?.days ?? null);
	const recent = $derived(
		ageOfMoneyInRange(series.data ?? [], presetRange('last_6_months', today), today)
	);
	const stat = $derived(ageOfMoneyChange(recent));
	const delta = $derived(
		stat && stat.months > 1
			? {
					text: m.reports_change_since({
						amount: `${stat.change > 0 ? '+' : ''}${daysLabel(stat.change)}`,
						month: formatMonth(stat.from, getLocale())
					}),
					up: stat.change >= 0
				}
			: null
	);
	const extremes = $derived(
		recent.length > 1
			? [
					{ key: 'low', label: m.reports_lowest(), days: Math.min(...recent.map((p) => p.days)) },
					{ key: 'high', label: m.reports_highest(), days: Math.max(...recent.map((p) => p.days)) }
				]
			: []
	);
</script>

<ReportCard
	title={m.reports_age_of_money()}
	route="/reports/age-of-money"
	testId="age-of-money-card"
>
	{#if series.error}
		<p class="text-sm text-destructive" role="alert">{errorMessage(series.error)}</p>
	{:else if series.data && current === null}
		<p class="text-sm text-muted-foreground">{m.reports_age_of_money_not_enough()}</p>
	{:else if current !== null}
		<StatTile
			value={daysLabel(current)}
			{delta}
			caption={m.reports_today()}
			testId="age-of-money-card-value"
		/>
		{#if recent.length > 1}
			<AgeOfMoneyChart points={recent} compact />
			<dl class="grid grid-cols-2 gap-2 text-sm" data-testid="age-of-money-card-extremes">
				{#each extremes as e (e.key)}
					<div class="grid gap-0.5 rounded-lg bg-muted/60 px-3 py-1.5">
						<dt class="text-xs text-muted-foreground">
							{e.label} · {m.reports_range_last_6_months()}
						</dt>
						<dd class="font-semibold tabular-nums">{daysLabel(e.days)}</dd>
					</div>
				{/each}
			</dl>
		{:else}
			<p class="text-sm text-muted-foreground">{m.reports_age_of_money_about()}</p>
		{/if}
	{/if}
</ReportCard>
