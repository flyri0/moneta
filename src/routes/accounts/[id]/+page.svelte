<script lang="ts">
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import RegisterRow from '$features/accounts/RegisterRow.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { PAGE_SIZE, registerBalances } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { TransactionRow } from '$db/repos/transactions';
	import { errorMessage } from '$i18n/errors';
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

	let dialogOpen = $state(false);
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

<div class="mx-auto grid max-w-6xl gap-4 p-3 md:p-6">
	{#if account.error && !account.data}
		<p class="text-destructive" role="alert">{errorMessage(account.error)}</p>
	{:else if account.data && balances}
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold" data-testid="register-title">{account.data.name}</h1>
				<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_cleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.cleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_uncleared_balance()}</dt>
						<dd class="tabular-nums">{session.format(balances.uncleared)}</dd>
					</div>
					<div class="flex gap-1">
						<dt class="text-muted-foreground">{m.register_total_balance()}</dt>
						<dd class="font-medium tabular-nums" data-testid="register-balance">
							{session.format(balances.total)}
						</dd>
					</div>
				</dl>
			</div>
			{#if !account.data.closed}
				<Button onclick={add}><PlusIcon />{m.add_transaction()}</Button>
			{/if}
		</header>

		<div class="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
			<Input
				type="search"
				bind:value={searchInput}
				placeholder={m.register_search()}
				aria-label={m.register_search()}
			/>
			<div class="flex items-center gap-2">
				<Label for="register-from" class="text-sm text-muted-foreground">{m.register_from()}</Label>
				<DatePicker
					id="register-from"
					bind:value={from}
					clearable
					placeholder={m.register_from()}
					class="w-36"
				/>
			</div>
			<div class="flex items-center gap-2">
				<Label for="register-to" class="text-sm text-muted-foreground">{m.register_to()}</Label>
				<DatePicker
					id="register-to"
					bind:value={to}
					clearable
					placeholder={m.register_to()}
					class="w-36"
				/>
			</div>
		</div>

		<section class="rounded-lg border" aria-label={m.register_transactions()}>
			{#if rows.error && !rows.data}
				<p class="p-6 text-center text-destructive" role="alert">{errorMessage(rows.error)}</p>
			{:else}
				{#each rows.data ?? [] as row (row.id)}
					<RegisterRow {row} onEdit={edit} />
				{:else}
					{#if rows.data}
						<p class="p-6 text-center text-muted-foreground">{m.register_empty()}</p>
					{/if}
				{/each}
			{/if}
		</section>
		{#if hasMore}
			<Button variant="outline" onclick={() => pages++}>{m.register_load_more()}</Button>
		{/if}
	{/if}
</div>

<TransactionDialog bind:open={dialogOpen} {accountId} transaction={editing} />
<svelte:head><title>{account.data?.name ?? m.nav_accounts()} · {m.app_name()}</title></svelte:head>
