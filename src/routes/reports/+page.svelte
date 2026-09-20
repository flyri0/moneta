<script lang="ts">
	import NetWorthReport from '$lib/components/reports/NetWorthReport.svelte';
	import PeriodBar from '$lib/components/reports/PeriodBar.svelte';
	import SpendingReport from '$lib/components/reports/SpendingReport.svelte';
	import { todayIso } from '$lib/domain/month';
	import { type DateRange, presetRange, type RangePreset } from '$lib/reports/range';
	import { m } from '$lib/paraglide/messages';

	// One range for the whole page: both reports answer the same question about the same slice.
	let preset = $state<RangePreset | 'custom'>('this_month');
	let custom = $state<DateRange>(presetRange('this_month', todayIso()));
	const range = $derived(preset === 'custom' ? custom : presetRange(preset, todayIso()));
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<h1 class="text-xl font-semibold">{m.nav_reports()}</h1>
	<PeriodBar bind:preset bind:custom {range} />
	<SpendingReport {range} />
	<NetWorthReport {range} />
</div>
<svelte:head><title>{m.nav_reports()} · {m.app_name()}</title></svelte:head>
