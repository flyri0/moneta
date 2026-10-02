<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ReceiptIcon from '@lucide/svelte/icons/receipt';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$ui/button';
	import EmptyState from '$components/EmptyState.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import RegisterRow from '$features/accounts/RegisterRow.svelte';
	import SelectionBar from '$features/accounts/SelectionBar.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { PAGE_SIZE } from '$features/accounts/register';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import type { RegisterSelection } from '$features/accounts/selection.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import type { TransactionRow } from '$db/repos/transactions';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The paged transaction list of one account, or of every account (showing each row's account)
	 * without `accountId`, narrowed by `filters` (whose controls sit in the page header). Rows open
	 * in the edit dialog, or, while `selection` is active, are chosen for its bar. With no rows it
	 * offers to add one (unless `canAdd` is false, as on a closed account) or to clear the filters.
	 */
	let {
		accountId,
		filters,
		selection,
		canAdd = true
	}: {
		accountId?: string;
		filters: RegisterFilters;
		selection?: RegisterSelection;
		canAdd?: boolean;
	} = $props();

	const session = useSession();

	let pages = $state(1);

	// A new search or filter starts paging over.
	$effect(() => {
		void [
			filters.search,
			filters.from,
			filters.to,
			filters.categoryId,
			filters.payeeId,
			filters.amountMin,
			filters.amountMax,
			filters.status
		];
		pages = 1;
	});

	// Only listed rows stay chosen: a deleted one, or one a new search leaves out, drops off.
	$effect(() => {
		const listed = rows.data?.map((r) => r.id);
		if (listed && selection) selection.keepOnly(listed);
	});

	const rows = useLive(
		session.client,
		['transactions', 'transaction_splits', 'payees', 'categories', 'accounts'],
		() =>
			session.api.transactions.list({
				accountId,
				search: filters.search || undefined,
				from: filters.from || undefined,
				to: filters.to || undefined,
				categoryId: filters.categoryId || undefined,
				payeeId: filters.payeeId || undefined,
				amountMin: filters.amountMin ?? undefined,
				amountMax: filters.amountMax ?? undefined,
				cleared: filters.status ? filters.status === 'cleared' : undefined,
				limit: pages * PAGE_SIZE
			})
	);
	const hasMore = $derived((rows.data?.length ?? 0) >= pages * PAGE_SIZE);
	const filtered = $derived(filters.active);

	let dialogOpen = $state(false);
	let editing = $state<TransactionRow | null>(null);

	/** A long press starts selecting with that row, or adds it to the rows already chosen. */
	function startWith(selection: RegisterSelection, row: TransactionRow) {
		selection.start();
		selection.select(row.id);
	}

	function edit(row: TransactionRow | null) {
		editing = row;
		dialogOpen = true;
	}
</script>

<section
	class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-opacity aria-busy:opacity-60 aria-busy:delay-150"
	aria-label={m.register_transactions()}
	aria-busy={rows.stale}
>
	{#if rows.error && !rows.data}
		<FormMessage error={actionError(rows.error)} class="justify-center p-6" />
	{:else}
		{#each rows.data ?? [] as row (row.id)}
			<RegisterRow
				{row}
				showAccount={!accountId}
				onEdit={edit}
				selecting={selection?.active}
				selected={selection?.has(row.id)}
				onSelect={(r) => selection?.toggle(r.id)}
				onLongPress={selection && ((r) => startWith(selection, r))}
				highlighted={selection?.changed.has(row.id)}
			/>
		{:else}
			{#if rows.data && filtered}
				<EmptyState class="py-8" icon={SearchXIcon} description={m.register_no_results()}>
					<Button size="sm" variant="outline" onclick={() => filters.clear()}>
						<XIcon />
						{m.register_clear_filters()}
					</Button>
				</EmptyState>
			{:else if rows.data}
				<EmptyState
					class="py-8"
					icon={ReceiptIcon}
					title={m.register_empty()}
					description={m.register_empty_body()}
				>
					{#if canAdd}
						<Button size="sm" onclick={() => edit(null)}>
							<PlusIcon />
							{m.register_add()}
						</Button>
					{/if}
				</EmptyState>
			{:else}
				<LoadingRows rows={8} />
			{/if}
		{/each}
	{/if}
</section>

{#if hasMore}
	<Button variant="outline" class="w-full" onclick={() => pages++}>
		{m.register_load_more()}
	</Button>
{/if}

{#if selection}
	<SelectionBar {selection} rows={rows.data ?? []} />
{/if}

<TransactionDialog bind:open={dialogOpen} {accountId} transaction={editing} />
