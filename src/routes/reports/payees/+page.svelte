<script lang="ts">
	import PayeesDetail from '$features/reports/PayeesDetail.svelte';
	import FlagFilterButton from '$features/reports/FlagFilterButton.svelte';
	import PeriodBar from '$features/reports/PeriodBar.svelte';
	import ReportPage from '$features/reports/ReportPage.svelte';
	import { todayIso } from '$domain/month';
	import { period, periodRange, clearFilters } from '$features/reports/period.svelte';
	import { m } from '$i18n/paraglide/messages';

	// Opens on the slice its card showed, until a period is picked here or on another report.
	const range = $derived(periodRange('this_month', todayIso()));
</script>

<ReportPage title={m.reports_payees()}>
	{#snippet toolbar()}
		<PeriodBar
			bind:preset={() => period.preset ?? 'this_month', (v) => (period.preset = v)}
			bind:custom={period.custom}
			{range}
		>
			<FlagFilterButton />
		</PeriodBar>
	{/snippet}
	<PayeesDetail {range} flags={period.flags} onClear={clearFilters('this_month')} />
</ReportPage>
