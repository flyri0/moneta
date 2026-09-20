<script lang="ts">
	import BackupCard from '$lib/components/settings/BackupCard.svelte';
	import BudgetDetails from '$lib/components/settings/BudgetDetails.svelte';
	import BudgetFiles from '$lib/components/settings/BudgetFiles.svelte';
	import CustomizationGroup from '$lib/components/settings/CustomizationGroup.svelte';
	import StorageCard from '$lib/components/settings/StorageCard.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:max-w-5xl md:p-6">
	<h1 class="text-xl font-semibold">{m.nav_settings()}</h1>
	<!-- Two explicit columns so the groups balance on desktop and stack in a sensible order. -->
	<div class="grid items-start gap-4 md:grid-cols-2">
		<div class="grid content-start gap-4">
			<CustomizationGroup />
			<BudgetDetails />
			<BudgetFiles />
		</div>
		<div class="grid content-start gap-4">
			<BackupCard />
			<StorageCard />
		</div>
	</div>
</div>
<svelte:head><title>{m.nav_settings()} · {m.app_name()}</title></svelte:head>
