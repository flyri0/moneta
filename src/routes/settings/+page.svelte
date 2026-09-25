<script lang="ts">
	import PageHeader from '$components/PageHeader.svelte';
	import AboutGroup from '$features/settings/AboutGroup.svelte';
	import BackupCard from '$features/settings/BackupCard.svelte';
	import BudgetDetails from '$features/settings/BudgetDetails.svelte';
	import BudgetFiles from '$features/settings/BudgetFiles.svelte';
	import CustomizationGroup from '$features/settings/CustomizationGroup.svelte';
	import StorageCard from '$features/settings/StorageCard.svelte';
	import { m } from '$i18n/paraglide/messages';
</script>

<PageHeader title={m.nav_settings()} class="max-w-2xl md:max-w-5xl" />

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:max-w-5xl md:p-6">
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
			<AboutGroup />
		</div>
	</div>
</div>
<svelte:head><title>{m.nav_settings()} · {m.app_name()}</title></svelte:head>
