<script lang="ts">
	import { Button } from '$ui/button';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { notifyError } from '$client/notify';
	import type { TransactionRow } from '$db/repos/transactions';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import {
		draftFromTransaction,
		newDraft,
		type FormContext,
		type TransactionDraft
	} from '$features/transactions/form';
	import TransactionForm from './TransactionForm.svelte';

	/**
	 * Adds a transaction, or edits `transaction`. The accounts, payees and categories it offers are
	 * loaded each time it opens.
	 */
	let {
		open = $bindable(false),
		accountId,
		transaction = null
	}: { open: boolean; accountId?: string; transaction?: TransactionRow | null } = $props();

	const session = useSession();
	const LAST_ACCOUNT_KEY = 'moneta.lastAccount';

	let ctx = $state.raw<FormContext | null>(null);
	let initial = $state.raw<TransactionDraft | null>(null);

	function readLastAccount(): string | null {
		try {
			return localStorage.getItem(LAST_ACCOUNT_KEY);
		} catch {
			return null;
		}
	}

	function rememberAccount(id: string) {
		try {
			localStorage.setItem(LAST_ACCOUNT_KEY, id);
		} catch {
			// Only a convenience.
		}
	}

	async function load(editing: TransactionRow | null, preferredAccount: string | undefined) {
		ctx = null;
		initial = null;
		try {
			const [accounts, payees, tree] = await Promise.all([
				session.api.accounts.list(),
				session.api.payees.list(),
				session.api.categories.tree()
			]);
			const context: FormContext = {
				accounts,
				payees,
				tree,
				money: session.money,
				transferLabel: (account) => m.transfer_payee({ account })
			};
			if (editing) {
				const pair =
					editing.transferId && editing.categoryId === null
						? await session.api.transactions.get(editing.transferId)
						: null;
				initial = draftFromTransaction(editing, context, pair);
			} else {
				const open = accounts.filter((a) => !a.closed);
				const pick =
					[preferredAccount, readLastAccount()].find((id) => open.some((a) => a.id === id)) ??
					open[0]?.id ??
					'';
				initial = newDraft(pick, todayIso());
			}
			ctx = context;
		} catch (err) {
			notifyError(err);
			open = false;
		}
	}

	$effect(() => {
		if (open) void load(transaction, accountId);
	});
</script>

<ResponsiveDialog
	bind:open
	title={transaction ? m.transaction_edit_title() : m.transaction_add_title()}
>
	{#if ctx && initial}
		{#if ctx.accounts.some((a) => !a.closed)}
			{#key initial}
				<TransactionForm
					{ctx}
					{initial}
					editingId={transaction?.id ?? null}
					onDone={(savedAccountId) => {
						if (savedAccountId) rememberAccount(savedAccountId);
						open = false;
					}}
				/>
			{/key}
		{:else}
			<p class="text-muted-foreground">{m.transaction_no_accounts()}</p>
			<Button variant="outline" onclick={() => (open = false)}>{m.close()}</Button>
		{/if}
	{:else}
		<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
	{/if}
</ResponsiveDialog>
