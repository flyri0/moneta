<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { LAST_ACCOUNT_KEY } from '$client/registry';
	import { notifyError, runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
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
	import TransactionOverview from './TransactionOverview.svelte';
	import { payeeDisplay, payeeText } from '$features/accounts/register';

	/**
	 * Adds a transaction, or opens `transaction` on its overview, from which it is edited or deleted.
	 * With `occurrence`, it enters that scheduled occurrence instead. The accounts, payees and
	 * categories it offers are loaded each time it opens.
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
	/** The transaction being edited, as the overview last had it. */
	let editing = $state.raw<TransactionRow | null>(null);
	/** An existing transaction opens on its overview; editing and deleting are screens of it. */
	let view = $state<'overview' | 'form' | 'delete'>('form');
	let addingAccount = $state(false);
	let error = $state<ActionError | null>(null);
	let busy = $state(false);

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
		existing: TransactionRow | null,
		preferredAccount: string | undefined,
		entering: OccurrenceToEnter | null
	) {
		ctx = null;
		initial = null;
		editing = null;
		view = existing && !entering ? 'overview' : 'form';
		addingAccount = false;
		error = null;
		try {
			const context = await loadFormContext(session.api, session.money);
			if (entering) {
				initial = {
					...draftFromSchedule(entering.schedule, context).txn,
					date: entering.date,
					memo: occurrenceMemo(entering.schedule, entering.index)
				};
			} else if (!existing) {
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

	/** The overview hands over the transaction as it is now. A transfer's form needs its other leg. */
	async function edit(current: TransactionRow) {
		const context = ctx;
		if (!context) return;
		try {
			const pair =
				current.transferId && current.categoryId === null
					? await session.api.transactions.get(current.transferId)
					: null;
			initial = draftFromTransaction(current, context, pair);
			editing = current;
			go('form');
		} catch (err) {
			notifyError(err);
		}
	}

	function go(next: typeof view) {
		view = next;
		error = null;
	}

	async function remove() {
		if (!transaction || busy) return;
		busy = true;
		const call = session.api.transactions.delete(transaction.id);
		error = await runAction(() => call);
		busy = false;
		if (error) return;
		open = false;
		offerUndo(session.client, call, m.transaction_deleted());
	}

	/** Entering an occurrence saves through the schedule, so it moves on to the next one. */
	const onSave = $derived.by(() => {
		const entering = occurrence;
		return entering
			? (input: TransactionInput) =>
					session.api.schedules.enter(entering.schedule.id, entering.index, input)
			: undefined;
	});

	const viewing = $derived(!occurrence && transaction ? transaction : null);
	const title = $derived(
		addingAccount
			? m.accounts_add()
			: occurrence
				? m.schedule_enter_title()
				: !viewing
					? m.transaction_add_title()
					: {
							overview: payeeText(payeeDisplay(viewing)),
							form: m.transaction_edit_title(),
							delete: m.transaction_delete_title()
						}[view]
	);
</script>

<ResponsiveDialog
	bind:open
	{title}
	onBack={addingAccount
		? () => (addingAccount = false)
		: viewing && view !== 'overview'
			? () => go('overview')
			: undefined}
>
	{#if !ctx}
		<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
	{:else if viewing && view === 'overview'}
		<TransactionOverview
			transactionId={viewing.id}
			onEdit={edit}
			onDelete={() => go('delete')}
			onLeave={() => (open = false)}
		/>
	{:else if viewing && view === 'delete'}
		<ConfirmPanel
			body={m.transaction_delete_body()}
			confirmLabel={m.delete()}
			{error}
			{busy}
			onCancel={() => go('overview')}
			onConfirm={remove}
		/>
	{:else if addingAccount}
		<AddAccountForm onCreated={(id) => void load(transaction, id, occurrence)} />
	{:else if !ctx.accounts.some((a) => !a.closed)}
		<NoOpenAccounts hasClosed={ctx.accounts.length > 0} onAdd={() => (addingAccount = true)} />
	{:else if initial}
		{#key initial}
			<TransactionForm
				{ctx}
				{initial}
				editingId={editing?.id ?? null}
				reconciled={!!editing?.reconciled}
				{onSave}
				onCancel={viewing ? () => go('overview') : undefined}
				onDone={(savedAccountId) => {
					if (savedAccountId) rememberAccount(savedAccountId);
					open = false;
				}}
			/>
		{/key}
	{/if}
</ResponsiveDialog>
