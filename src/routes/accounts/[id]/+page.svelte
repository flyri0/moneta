<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import AccountSettingsDialog from '$features/accounts/AccountSettingsDialog.svelte';
	import { accountTypeIcon } from '$features/accounts/account-icons';
	import Register from '$features/accounts/Register.svelte';
	import RegisterToolbar from '$features/accounts/RegisterToolbar.svelte';
	import { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import UpcomingSection from '$features/accounts/UpcomingSection.svelte';
	import { FORECAST_DAYS, projectBalances, registerBalances } from '$features/accounts/register';
	import { addDays, todayIso } from '$domain/month';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import { accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);
	const AccountIcon = $derived(account.data ? accountTypeIcon(account.data.type) : null);

	const today = todayIso();
	const upcoming = useLive(
		session.client,
		['schedules', 'schedule_splits', 'accounts', 'payees', 'categories'],
		() => session.api.schedules.upcoming({ accountId, today, to: addDays(today, FORECAST_DAYS) })
	);
	const projected = $derived(
		account.data && upcoming.data ? projectBalances(account.data.balance, upcoming.data) : []
	);

	const filters = new RegisterFilters();
	// Another account (e.g. through a transfer's link) starts with no search or dates.
	$effect(() => {
		void accountId;
		untrack(() => filters.clear());
	});

	let adding = $state(false);
	let settingsOpen = $state(false);
</script>

{#if account.data}
	<PageHeader back={{ route: '/accounts', label: m.nav_accounts() }}>
		{#snippet title()}
			<div class="flex min-w-0 items-center gap-3">
				{#if AccountIcon}
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
					>
						<AccountIcon class="size-5" />
					</div>
				{/if}
				<div class="grid min-w-0 gap-0.5">
					<div class="flex min-w-0 items-center gap-1">
						<h1 class="truncate text-xl font-semibold tracking-tight" data-testid="register-title">
							{account.data?.name}
						</h1>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.account_settings_for({ name: account.data?.name ?? '' })}
							onclick={() => (settingsOpen = true)}
						>
							<SettingsIcon class="size-4 text-muted-foreground" />
						</Button>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">
							{account.data ? accountTypeLabel(account.data.type) : ''}
						</span>
						{#if account.data?.closed}
							<span
								class="rounded bg-destructive/10 px-1.5 py-0.5 text-[0.6875rem] font-medium text-destructive"
							>
								{m.accounts_closed()}
							</span>
						{/if}
					</div>
				</div>
			</div>
		{/snippet}
		{#snippet actions()}
			{#if !account.data?.closed}
				<Button size="sm" aria-label={m.add_transaction()} onclick={() => (adding = true)}>
					<PlusIcon />
					<span class="hidden md:inline">{m.add_transaction()}</span>
				</Button>
			{/if}
		{/snippet}
		{#snippet toolbar()}<RegisterToolbar {filters} />{/snippet}
	</PageHeader>
{/if}

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if account.error && !account.data}
		<FormMessage error={actionError(account.error)} />
	{:else if account.data && balances}
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
			{#if projected.length > 0}
				<div class="flex items-center justify-between gap-3 border-t pt-3">
					<span class="text-xs text-muted-foreground">{m.register_projected_balance()}</span>
					<span class="font-medium tabular-nums" data-testid="register-projected">
						{session.format(projected[projected.length - 1])}
					</span>
				</div>
			{/if}
		</section>

		{#if upcoming.data && upcoming.data.length > 0}
			<UpcomingSection occurrences={upcoming.data} balances={projected} />
		{/if}

		<!-- Keyed so that switching accounts (e.g. the transfer link) starts paging over. -->
		{#key accountId}
			<Register {accountId} {filters} />
		{/key}
	{/if}
</div>

<TransactionDialog bind:open={adding} {accountId} />
{#if account.data}
	<AccountSettingsDialog bind:open={settingsOpen} account={account.data} />
{/if}
<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
