<script lang="ts">
	import CategoryTrendsDetail from '$features/reports/CategoryTrendsDetail.svelte';
	import PeriodBar from '$features/reports/PeriodBar.svelte';
	import ReportPage from '$features/reports/ReportPage.svelte';
	import { todayIso } from '$domain/month';
	import { period, periodRange } from '$features/reports/period.svelte';
	import { m } from '$i18n/paraglide/messages';

	// Opens on the slice its card showed, until a period is picked here or on another report.
	const range = $derived(periodRange('last_6_months', todayIso()));
</script>

<ReportPage title={m.reports_category_trends()}>
	<PeriodBar
		bind:preset={() => period.preset ?? 'last_6_months', (v) => (period.preset = v)}
		bind:custom={period.custom}
		{range}
	/>
	<CategoryTrendsDetail {range} />
</ReportPage>
