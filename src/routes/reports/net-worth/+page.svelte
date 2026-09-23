<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import NetWorthDetail from '$features/reports/NetWorthDetail.svelte';
	import PeriodBar from '$features/reports/PeriodBar.svelte';
	import { todayIso } from '$domain/month';
	import { period, periodRange } from '$features/reports/period.svelte';
	import { m } from '$i18n/paraglide/messages';

	// Opens on the slice its card showed, until a period is picked here or on the other report.
	const range = $derived(periodRange('last_6_months', todayIso()));
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<nav class="flex items-center gap-1 text-sm text-muted-foreground">
		<a
			href={resolve('/reports')}
			class="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium transition-colors hover:text-foreground"
		>
			<ChevronLeftIcon class="size-4" />
			<span>{m.nav_reports()}</span>
		</a>
	</nav>
	<h1 class="text-xl font-semibold">{m.reports_net_worth()}</h1>
	<PeriodBar
		bind:preset={() => period.preset ?? 'last_6_months', (v) => (period.preset = v)}
		bind:custom={period.custom}
		{range}
	/>
	<NetWorthDetail {range} />
</div>
<svelte:head><title>{m.reports_net_worth()} · {m.app_name()}</title></svelte:head>
