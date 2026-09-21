<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$ui/button';
	import AccountList from '$features/accounts/AccountList.svelte';
	import AccountSettingsDialog from '$features/accounts/AccountSettingsDialog.svelte';
	import AddAccountDialog from '$features/accounts/AddAccountDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { Account } from '$db/repos/accounts';
	import { m } from '$i18n/paraglide/messages';

	const session = useSession();
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);
	let adding = $state(false);
	let settingsOpen = $state(false);
	let selected = $state<Account | null>(null);

	const totalBalance = $derived(
		accounts.data
			? accounts.data.filter((a) => !a.closed).reduce((sum, a) => sum + a.balance, 0)
			: 0
	);
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">{m.nav_accounts()}</h1>
		<Button onclick={() => (adding = true)}>
			<PlusIcon />
			{m.accounts_add()}
		</Button>
	</header>

	{#if accounts.data && accounts.data.length > 0}
		<section
			class="grid gap-1.5 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
			aria-label={m.accounts_total_balance()}
		>
			<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				{m.accounts_total_balance()}
			</span>
			<span
				class="text-2xl font-bold tracking-tight {totalBalance < 0 ? 'text-destructive' : ''}"
				data-testid="accounts-total-balance"
			>
				{session.format(totalBalance)}
			</span>
		</section>
	{/if}

	{#if accounts.data?.length === 0}
		<div class="rounded-xl border bg-card p-8 text-center text-card-foreground shadow-xs">
			<p class="text-sm text-muted-foreground">{m.accounts_empty()}</p>
		</div>
	{/if}
	<AccountList
		accounts={accounts.data ?? []}
		onSettings={(account) => {
			selected = account;
			settingsOpen = true;
		}}
	/>
</div>

<AddAccountDialog bind:open={adding} />
{#if selected}
	<AccountSettingsDialog bind:open={settingsOpen} account={selected} />
{/if}
<svelte:head><title>{m.nav_accounts()} · {m.app_name()}</title></svelte:head>
