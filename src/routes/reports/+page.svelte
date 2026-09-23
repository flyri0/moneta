<script lang="ts">
	import NetWorthCard from '$features/reports/NetWorthCard.svelte';
	import SpendingCard from '$features/reports/SpendingCard.svelte';
	import { m } from '$i18n/paraglide/messages';
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<h1 class="text-xl font-semibold">{m.nav_reports()}</h1>
	<div class="grid gap-4 lg:grid-cols-2 lg:items-start">
		<SpendingCard />
		<NetWorthCard />
	</div>
</div>
<svelte:head><title>{m.nav_reports()} · {m.app_name()}</title></svelte:head>
