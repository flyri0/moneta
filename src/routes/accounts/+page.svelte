<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { Button } from '$ui/button';
	import EmptyState from '$components/EmptyState.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import AccountList from '$features/accounts/AccountList.svelte';
	import AccountSettingsDialog from '$features/accounts/AccountSettingsDialog.svelte';
	import AddAccountDialog from '$features/accounts/AddAccountDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
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

<PageHeader title={m.nav_accounts()}>
	{#snippet actions()}
		<Button size="sm" onclick={() => (adding = true)}>
			<PlusIcon />
			{m.accounts_add()}
		</Button>
	{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if accounts.data && accounts.data.length > 0}
		<section
			class="grid gap-1.5 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
			aria-label={m.accounts_total_balance()}
		>
			<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				{m.accounts_total_balance()}
			</span>
			<span class="text-2xl font-bold tracking-tight" data-testid="accounts-total-balance">
				{session.format(totalBalance)}
			</span>
		</section>
	{/if}

	{#if accounts.data?.length === 0}
		<EmptyState
			framed
			icon={WalletIcon}
			title={m.accounts_empty()}
			description={m.accounts_empty_body()}
		>
			<Button size="sm" onclick={() => (adding = true)}>
				<PlusIcon />
				{m.accounts_add()}
			</Button>
		</EmptyState>
	{:else if !accounts.data && accounts.error}
		<FormMessage error={actionError(accounts.error)} />
	{:else if !accounts.data}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs"><LoadingRows rows={4} /></div>
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
