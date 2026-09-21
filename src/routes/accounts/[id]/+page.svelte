<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import AccountSettingsDialog from '$features/accounts/AccountSettingsDialog.svelte';
	import { accountTypeIcon } from '$features/accounts/account-icons';
	import RegisterRow from '$features/accounts/RegisterRow.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { PAGE_SIZE, registerBalances } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { TransactionRow } from '$db/repos/transactions';
	import { errorMessage } from '$i18n/errors';
	import { accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	const accountId = $derived(page.params.id ?? '');
	const session = useSession();

	let searchInput = $state('');
	let search = $state('');
	let from = $state('');
	let to = $state('');
	let pages = $state(1);

	// Search as the user types, but not on every keystroke.
	$effect(() => {
		const text = searchInput;
		const timer = setTimeout(() => {
			search = text;
			pages = 1;
		}, 250);
		return () => clearTimeout(timer);
	});

	// The date filter applies immediately (it isn't debounced): restart paging with it.
	$effect(() => {
		void from;
		void to;
		pages = 1;
	});

	// The component is reused across /accounts/[id] navigations (e.g. the transfer link in
	// RegisterRow), so switching accounts must also clear the filters and paging.
	$effect(() => {
		void accountId;
		searchInput = '';
		search = '';
		from = '';
		to = '';
		pages = 1;
	});

	const account = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.get(accountId)
	);
	const rows = useLive(
		session.client,
		['transactions', 'transaction_splits', 'payees', 'categories', 'accounts'],
		() =>
			session.api.transactions.list({
				accountId,
				search: search || undefined,
				from: from || undefined,
				to: to || undefined,
				limit: pages * PAGE_SIZE
			})
	);
	const balances = $derived(account.data ? registerBalances(account.data) : null);
	const hasMore = $derived((rows.data?.length ?? 0) >= pages * PAGE_SIZE);
	const AccountIcon = $derived(account.data ? accountTypeIcon(account.data.type) : null);

	let dialogOpen = $state(false);
	let settingsOpen = $state(false);
	let editing = $state<TransactionRow | null>(null);

	function add() {
		editing = null;
		dialogOpen = true;
	}

	function edit(row: TransactionRow) {
		editing = row;
		dialogOpen = true;
	}
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
				<Button onclick={add}><PlusIcon />{m.add_transaction()}</Button>
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

		<div class="grid gap-2 sm:flex sm:items-center sm:gap-3">
			<div class="relative flex-1">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					bind:value={searchInput}
					placeholder={m.register_search()}
					aria-label={m.register_search()}
					class="pl-9"
				/>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
				<div class="flex items-center gap-1.5">
					<Label for="register-from" class="shrink-0 text-xs font-medium text-muted-foreground">
						{m.register_from()}
					</Label>
					<DatePicker
						id="register-from"
						bind:value={from}
						clearable
						placeholder={m.register_from()}
						class="w-full sm:w-36"
					/>
				</div>
				<div class="flex items-center gap-1.5">
					<Label for="register-to" class="shrink-0 text-xs font-medium text-muted-foreground">
						{m.register_to()}
					</Label>
					<DatePicker
						id="register-to"
						bind:value={to}
						clearable
						placeholder={m.register_to()}
						class="w-full sm:w-36"
					/>
				</div>
			</div>
		</div>

		<section
			class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
			aria-label={m.register_transactions()}
		>
			{#if rows.error && !rows.data}
				<p class="p-6 text-center text-destructive" role="alert">{errorMessage(rows.error)}</p>
			{:else}
				{#each rows.data ?? [] as row (row.id)}
					<RegisterRow {row} onEdit={edit} />
				{:else}
					{#if rows.data}
						<p class="p-8 text-center text-sm text-muted-foreground">{m.register_empty()}</p>
					{/if}
				{/each}
			{/if}
		</section>

		{#if hasMore}
			<Button variant="outline" class="w-full" onclick={() => pages++}>
				{m.register_load_more()}
			</Button>
		{/if}
	{/if}
</div>

<TransactionDialog bind:open={dialogOpen} {accountId} transaction={editing} />
{#if account.data}
	<AccountSettingsDialog bind:open={settingsOpen} account={account.data} />
{/if}
<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
