<script lang="ts">
	import AgeOfMoneyChart from './AgeOfMoneyChart.svelte';
	import ReportCard from './ReportCard.svelte';
	import StatTile from './StatTile.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
	import {
		AGE_OF_MONEY_TABLES,
		ageOfMoneyInRange,
		daysLabel
	} from '$features/reports/age-of-money';
	import { presetRange } from '$features/reports/range';
	import { m } from '$i18n/paraglide/messages';

	/** Today's Age of Money over the curve of the last six months, like YNAB's card. */
	const session = useSession();
	const today = todayIso();

	const series = useLive(session.client, AGE_OF_MONEY_TABLES, () =>
		session.api.reports.ageOfMoney(today)
	);
	const current = $derived(series.data?.at(-1)?.days ?? null);
	const recent = $derived(
		ageOfMoneyInRange(series.data ?? [], presetRange('last_6_months', today), today)
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
			caption={m.reports_today()}
			testId="age-of-money-card-value"
		/>
		{#if recent.length > 1}
			<AgeOfMoneyChart points={recent} compact />
		{/if}
	{/if}
</ReportCard>
