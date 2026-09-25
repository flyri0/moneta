<script lang="ts">
	import SpendingDetail from '$features/reports/SpendingDetail.svelte';
	import PeriodBar from '$features/reports/PeriodBar.svelte';
	import ReportPage from '$features/reports/ReportPage.svelte';
	import { todayIso } from '$domain/month';
	import { period, periodRange } from '$features/reports/period.svelte';
	import { m } from '$i18n/paraglide/messages';

	// Opens on the slice its card showed, until a period is picked here or on another report.
	const range = $derived(periodRange('this_month', todayIso()));
</script>

<ReportPage title={m.reports_spending()}>
	{#snippet toolbar()}
		<PeriodBar
			bind:preset={() => period.preset ?? 'this_month', (v) => (period.preset = v)}
			bind:custom={period.custom}
			{range}
		/>
	{/snippet}
	<SpendingDetail {range} />
</ReportPage>
