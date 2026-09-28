<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { LAST_ACCOUNT_KEY } from '$client/registry';
	import { notifyError } from '$client/notify';
	import type { TransactionInput, TransactionRow } from '$db/repos/transactions';
	import { occurrenceMemo } from '$domain/installments';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import {
		draftFromTransaction,
		newDraft,
		type FormContext,
		type TransactionDraft
	} from '$features/transactions/form';
	import { loadFormContext } from '$features/transactions/context';
	import AddAccountForm from '$features/accounts/AddAccountForm.svelte';
	import NoOpenAccounts from '$features/accounts/NoOpenAccounts.svelte';
	import { draftFromSchedule, type OccurrenceToEnter } from '$features/schedules/form';
	import TransactionForm from './TransactionForm.svelte';

	/**
	 * Adds a transaction, or edits `transaction`. With `occurrence`, it enters that scheduled
	 * occurrence instead. The accounts, payees and categories it offers are loaded each time it opens.
	 */
	let {
		open = $bindable(false),
		accountId,
		transaction = null,
		occurrence = null
	}: {
		open: boolean;
		accountId?: string;
		transaction?: TransactionRow | null;
		occurrence?: OccurrenceToEnter | null;
	} = $props();

	const session = useSession();

	let ctx = $state.raw<FormContext | null>(null);
	let initial = $state.raw<TransactionDraft | null>(null);
	let confirming = $state(false);
	let addingAccount = $state(false);

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

	async function load(
		editing: TransactionRow | null,
		preferredAccount: string | undefined,
		entering: OccurrenceToEnter | null
	) {
		ctx = null;
		initial = null;
		confirming = false;
		addingAccount = false;
		try {
			const context = await loadFormContext(session.api, session.money);
			if (entering) {
				initial = {
					...draftFromSchedule(entering.schedule, context).txn,
					date: entering.date,
					memo: occurrenceMemo(entering.schedule, entering.index)
				};
			} else if (editing) {
				const pair =
					editing.transferId && editing.categoryId === null
						? await session.api.transactions.get(editing.transferId)
						: null;
				initial = draftFromTransaction(editing, context, pair);
			} else {
				const open = context.accounts.filter((a) => !a.closed);
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
		if (open) void load(transaction, accountId, occurrence);
	});

	/** Entering an occurrence saves through the schedule, so it moves on to the next one. */
	const onSave = $derived.by(() => {
		const entering = occurrence;
		return entering
			? (input: TransactionInput) =>
					session.api.schedules.enter(entering.schedule.id, entering.index, input)
			: undefined;
	});
</script>

<ResponsiveDialog
	bind:open
	title={addingAccount
		? m.accounts_add()
		: confirming
			? m.transaction_delete_title()
			: occurrence
				? m.schedule_enter_title()
				: transaction
					? m.transaction_edit_title()
					: m.transaction_add_title()}
	onBack={addingAccount
		? () => (addingAccount = false)
		: confirming
			? () => (confirming = false)
			: undefined}
>
	{#if ctx && initial}
		{#if ctx.accounts.some((a) => !a.closed)}
			{#key initial}
				<TransactionForm
					{ctx}
					{initial}
					editingId={occurrence ? null : (transaction?.id ?? null)}
					reconciled={!occurrence && !!transaction?.reconciled}
					{onSave}
					bind:confirming
					onDone={(savedAccountId) => {
						if (savedAccountId) rememberAccount(savedAccountId);
						open = false;
					}}
				/>
			{/key}
		{:else if addingAccount}
			<AddAccountForm onCreated={(id) => void load(transaction, id, occurrence)} />
		{:else}
			<NoOpenAccounts hasClosed={ctx.accounts.length > 0} onAdd={() => (addingAccount = true)} />
		{/if}
	{:else}
		<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
	{/if}
</ResponsiveDialog>
