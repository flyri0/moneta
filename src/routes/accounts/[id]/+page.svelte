<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$ui/button';
	import AccountSettingsDialog from '$features/accounts/AccountSettingsDialog.svelte';
	import { accountTypeIcon } from '$features/accounts/account-icons';
	import Register from '$features/accounts/Register.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { registerBalances } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { errorMessage } from '$i18n/errors';
	import { accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);
	const AccountIcon = $derived(account.data ? accountTypeIcon(account.data.type) : null);

	let adding = $state(false);
	let settingsOpen = $state(false);
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if account.error && !account.data}
		<p class="text-destructive" role="alert">{errorMessage(account.error)}</p>
	{:else if account.data && balances}
		<nav class="flex items-center gap-1 text-sm text-muted-foreground">
			<a
				href={resolve('/accounts')}
				class="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium transition-colors hover:text-foreground"
			>
				<ChevronLeftIcon class="size-4" />
				<span>{m.nav_accounts()}</span>
			</a>
		</nav>

		<header class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				{#if AccountIcon}
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
					>
						<AccountIcon class="size-5" />
					</div>
				{/if}
				<div class="grid gap-0.5">
					<div class="flex items-center gap-2">
						<h1 class="text-xl font-semibold tracking-tight" data-testid="register-title">
							{account.data.name}
						</h1>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.account_settings_for({ name: account.data.name })}
							onclick={() => (settingsOpen = true)}
						>
							<SettingsIcon class="size-4 text-muted-foreground" />
						</Button>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">{accountTypeLabel(account.data.type)}</span>
						{#if account.data.closed}
							<span
								class="rounded bg-destructive/10 px-1.5 py-0.5 text-[0.6875rem] font-medium text-destructive"
							>
								{m.accounts_closed()}
							</span>
						{/if}
					</div>
				</div>
			</div>
			{#if !account.data.closed}
				<Button onclick={() => (adding = true)}><PlusIcon />{m.add_transaction()}</Button>
			{/if}
		</header>

		<section
			class="grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
			aria-label={m.register_total_balance()}
		>
			<div class="grid gap-0.5">
				<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
					{m.register_total_balance()}
				</span>
				<span
					class="text-2xl font-bold tracking-tight {balances.total < 0 ? 'text-destructive' : ''}"
					data-testid="register-balance"
				>
					{session.format(balances.total)}
				</span>
			</div>
			<div class="grid grid-cols-2 gap-3 border-t pt-3">
				<div class="grid gap-0.5">
					<span class="text-xs text-muted-foreground">{m.register_cleared_balance()}</span>
					<span class="font-medium tabular-nums">{session.format(balances.cleared)}</span>
				</div>
				<div class="grid gap-0.5">
					<span class="text-xs text-muted-foreground">{m.register_uncleared_balance()}</span>
					<span class="font-medium tabular-nums">{session.format(balances.uncleared)}</span>
				</div>
			</div>
		</section>

		<!-- Keyed so that switching accounts (e.g. the transfer link) clears the filters and paging. -->
		{#key accountId}
			<Register {accountId} />
		{/key}
	{/if}
</div>

<TransactionDialog bind:open={adding} {accountId} />
{#if account.data}
	<AccountSettingsDialog bind:open={settingsOpen} account={account.data} />
{/if}
<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
