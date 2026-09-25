<script lang="ts">
	import PageHeader from '$components/PageHeader.svelte';
	import Register from '$features/accounts/Register.svelte';
	import RegisterToolbar from '$features/accounts/RegisterToolbar.svelte';
	import { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { m } from '$i18n/paraglide/messages';

	const filters = new RegisterFilters();
</script>

<PageHeader title={m.nav_transactions()}>
	{#snippet toolbar()}<RegisterToolbar {filters} />{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<Register {filters} />
</div>
<svelte:head><title>{m.nav_transactions()} · {m.app_name()}</title></svelte:head>
