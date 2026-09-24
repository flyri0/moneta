<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import RegisterRow from '$features/accounts/RegisterRow.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { PAGE_SIZE } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { TransactionRow } from '$db/repos/transactions';
	import { errorMessage } from '$i18n/errors';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The searchable, paged transaction list of one account, or of every account (showing each
	 * row's account) without `accountId`. Rows open in the edit dialog.
	 */
	let { accountId }: { accountId?: string } = $props();

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
	const hasMore = $derived((rows.data?.length ?? 0) >= pages * PAGE_SIZE);

	let dialogOpen = $state(false);
	let editing = $state<TransactionRow | null>(null);

	function edit(row: TransactionRow) {
		editing = row;
		dialogOpen = true;
	}
</script>

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
			<RegisterRow {row} showAccount={!accountId} onEdit={edit} />
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

<TransactionDialog bind:open={dialogOpen} {accountId} transaction={editing} />
