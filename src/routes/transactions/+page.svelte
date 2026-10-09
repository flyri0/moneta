<script lang="ts">
	import { resolve } from '$app/paths';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { Button } from '$ui/button';
	import PageHeader from '$components/PageHeader.svelte';
	import Register from '$features/accounts/Register.svelte';
	import RegisterToolbar from '$features/accounts/RegisterToolbar.svelte';
	import SelectButton from '$features/accounts/SelectButton.svelte';
	import { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { RegisterSelection } from '$features/accounts/selection.svelte';
	import TransactionsTabs from '$features/transactions/TransactionsTabs.svelte';
	import { m } from '$i18n/paraglide/messages';

	const filters = new RegisterFilters();
	const selection = new RegisterSelection();
</script>

<PageHeader title={m.nav_transactions()}>
	{#snippet actions()}
		<Button variant="outline" size="sm" href={resolve('/payees')} aria-label={m.nav_payees()}>
			<UsersIcon />
			<span class="hidden md:inline">{m.nav_payees()}</span>
		</Button>
		<SelectButton {selection} />
	{/snippet}
	{#snippet toolbar()}
		<TransactionsTabs />
		<RegisterToolbar {filters} />
	{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<Register {filters} {selection} />
</div>
<svelte:head><title>{m.nav_transactions()} · {m.app_name()}</title></svelte:head>
