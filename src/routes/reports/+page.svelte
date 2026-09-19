<script lang="ts">
	import NetWorthReport from '$lib/components/reports/NetWorthReport.svelte';
	import SpendingReport from '$lib/components/reports/SpendingReport.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="mx-auto grid max-w-3xl gap-4 p-3 md:p-6">
	<h1 class="text-xl font-semibold">{m.nav_reports()}</h1>
	<SpendingReport />
	<NetWorthReport />
</div>
<svelte:head><title>{m.nav_reports()} · {m.app_name()}</title></svelte:head>
