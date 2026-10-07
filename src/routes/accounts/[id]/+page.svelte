<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import AccountSettingsDialog from '$features/accounts/AccountSettingsDialog.svelte';
	import ReconcileDialog from '$features/accounts/ReconcileDialog.svelte';
	import { importHandoff } from '$features/accounts/import/pending.svelte';
	import { readStatement } from '$features/accounts/import/read';
	import AccountIcon from '$features/accounts/AccountIcon.svelte';
	import Register from '$features/accounts/Register.svelte';
	import RegisterToolbar from '$features/accounts/RegisterToolbar.svelte';
	import { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { RegisterSelection } from '$features/accounts/selection.svelte';
	import SelectButton from '$features/accounts/SelectButton.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import UpcomingSection from '$features/accounts/UpcomingSection.svelte';
	import { FORECAST_DAYS, projectBalances, registerBalances } from '$features/accounts/register';
	import { addDays, todayIso } from '$domain/month';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, notifyError } from '$client/notify';
	import { currencyDigits } from '$domain/money';
	import { formatDate } from '$i18n/formats';
	import { accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);

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
	const selection = new RegisterSelection();
	// Another account (e.g. through a transfer's link) starts with no search or dates.
	$effect(() => {
		void accountId;
		untrack(() => {
			filters.clear();
			selection.stop();
		});
	});

	let adding = $state(false);
	let settingsOpen = $state(false);
	let reconciling = $state(false);
	/** A statement's balance to reconcile against, when the dialog opens after an import. */
	let reconcileStatement = $state<{ balance: number; date: string } | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	function reconcile() {
		reconcileStatement = null;
		reconciling = true;
	}

	// The toast after an import offers to reconcile against the statement's balance.
	$effect(() => {
		const request = importHandoff.reconcile;
		if (!request || request.accountId !== accountId) return;
		importHandoff.reconcile = null;
		reconcileStatement = { balance: request.balance, date: request.date };
		reconciling = true;
	});

	/** Reads the picked statement and opens the import page to review it. */
	async function importFile(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const read = readStatement(bytes, currencyDigits(session.money.currency));
			importHandoff.statement = { ...read, accountId, fileName: file.name };
			await goto(resolve('/accounts/[id]/import', { id: accountId }));
		} catch (err) {
			notifyError(err);
		}
	}
</script>

{#if account.data}
	<PageHeader back={{ route: '/accounts', label: m.nav_accounts() }}>
		{#snippet title()}
			<div class="flex min-w-0 items-center gap-3">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
				>
					{#if account.data}
						<AccountIcon account={account.data} class="size-5 text-xl" />
					{/if}
				</div>
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
			<SelectButton {selection} />
			{#if !account.data?.closed}
				<Button
					variant="outline"
					size="sm"
					aria-label={m.import_statement()}
					onclick={() => fileInput?.click()}
				>
					<UploadIcon />
					<span class="hidden md:inline">{m.import_statement()}</span>
				</Button>
				<input
					bind:this={fileInput}
					type="file"
					class="hidden"
					accept=".ofx,.qfx,.csv,.txt,text/csv"
					onchange={importFile}
					data-testid="import-file"
				/>
				<Button size="sm" aria-label={m.add_transaction()} onclick={() => (adding = true)}>
					<PlusIcon />
					<span class="hidden md:inline">{m.add_transaction()}</span>
				</Button>
			{/if}
		{/snippet}
		{#snippet toolbar()}<RegisterToolbar {filters} />{/snippet}
	</PageHeader>
{:else}
	<!-- While loading, or when the account can't be read, the way back is still there. -->
	<PageHeader title={m.nav_accounts()} back={{ route: '/accounts', label: m.nav_accounts() }} />
{/if}

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if account.error && !account.data}
		<FormMessage error={actionError(account.error)} />
	{:else if account.data && balances}
		<section
			class="grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
			aria-label={m.register_total_balance()}
		>
			<div class="flex items-start justify-between gap-3">
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
				{#if !account.data.closed}
					<Button variant="outline" size="sm" onclick={reconcile}>
						<LockIcon />
						{m.reconcile()}
					</Button>
				{/if}
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
			{#if account.data.reconciledOn}
				<p class="text-xs text-muted-foreground" data-testid="register-reconciled-on">
					{m.reconcile_last({ date: formatDate(account.data.reconciledOn, getLocale()) })}
				</p>
			{/if}
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
			<Register {accountId} {filters} {selection} canAdd={!account.data.closed} />
		{/key}
	{:else if !account.data}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs">
			<LoadingRows rows={8} />
		</div>
	{/if}
</div>

<TransactionDialog bind:open={adding} {accountId} />
{#if account.data}
	<AccountSettingsDialog bind:open={settingsOpen} account={account.data} />
	<ReconcileDialog bind:open={reconciling} account={account.data} statement={reconcileStatement} />
{/if}
<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
