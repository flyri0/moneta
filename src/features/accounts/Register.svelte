<script lang="ts">
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import RegisterRow from '$features/accounts/RegisterRow.svelte';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { PAGE_SIZE } from '$features/accounts/register';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import type { TransactionRow } from '$db/repos/transactions';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The paged transaction list of one account, or of every account (showing each row's account)
	 * without `accountId`, narrowed by `filters` (whose controls sit in the page header). Rows open
	 * in the edit dialog.
	 */
	let { accountId, filters }: { accountId?: string; filters: RegisterFilters } = $props();

	const session = useSession();

	let pages = $state(1);

	// A new search or date range starts paging over.
	$effect(() => {
		void filters.search;
		void filters.from;
		void filters.to;
		pages = 1;
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

<section
	class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
	aria-label={m.register_transactions()}
>
	{#if rows.error && !rows.data}
		<FormMessage error={actionError(rows.error)} class="justify-center p-6" />
	{:else}
		{#each rows.data ?? [] as row (row.id)}
			<RegisterRow {row} showAccount={!accountId} onEdit={edit} />
		{:else}
			{#if rows.data}
				<p class="p-8 text-center text-sm text-muted-foreground">{m.register_empty()}</p>
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

<TransactionDialog bind:open={dialogOpen} {accountId} transaction={editing} />
