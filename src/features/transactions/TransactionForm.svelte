<script lang="ts">
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import SheetLink from '$components/SheetLink.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { TransactionInput } from '$db/repos/transactions';
	import { isFarFuture, todayIso } from '$domain/month';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import {
		buildTransactionInput,
		canSplit,
		splitRemaining,
		type FormContext,
		type TransactionDraft
	} from '$features/transactions/form';
	import { FORM_ERRORS } from '$features/transactions/form-errors';
	import {
		canInstall,
		installmentCount,
		installmentPlan
	} from '$features/transactions/installments';
	import TransactionFields from './TransactionFields.svelte';
	import {
		NewCategories,
		categoryValues,
		withCategoryIds
	} from '$features/categories/new-categories';

	/** `onSave`, when given, replaces the create/update write (entering a scheduled occurrence). */
	let {
		ctx,
		initial,
		editingId,
		reconciled = false,
		onSave,
		confirming = $bindable(false),
		onDone
	}: {
		ctx: FormContext;
		initial: TransactionDraft;
		editingId: string | null;
		/** The transaction being edited was reconciled: it stays cleared while in its account. */
		reconciled?: boolean;
		onSave?: (input: TransactionInput) => Promise<unknown>;
		/** Whether the delete confirmation shows in place of the form (the dialog titles it). */
		confirming?: boolean;
		onDone: (savedAccountId: string | null) => void;
	} = $props();

	const session = useSession();
	// The dialog re-creates this form (with {#key}) for every transaction it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(initial));
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	const pending = new NewCategories();
	/** A date years ahead the user was asked about: saving it again goes ahead. */
	let farDate = $state<string | null>(null);
	const askingFar = $derived(farDate !== null && farDate === draft.date);
	/** A reconciled transaction stays cleared unless it moves to another account. */
	const lockedCleared = $derived(reconciled && draft.accountId === initial.accountId);

	/** Installments, as typed: only a new card purchase offers them. */
	let installments = $state('');
	const installable = $derived(!editingId && !onSave && canInstall(draft, ctx));
	const plan = $derived(installable ? installmentPlan(draft, ctx, installments) : null);
	const planText = $derived.by(() => {
		if (!plan) return '';
		const amount = session.format(plan.rest);
		const split =
			plan.first === plan.rest
				? m.transaction_installments_plan({ count: plan.count, amount })
				: m.transaction_installments_plan_first({
						first: session.format(plan.first),
						count: plan.count - 1,
						amount
					});
		if (!plan.firstDate) return split;
		const date = formatDate(plan.firstDate, getLocale());
		return `${split} · ${m.transaction_installments_first_due({ date })}`;
	});

	/** Split lines that don't add up yet keep Save disabled. */
	const blocked = $derived(
		draft.splits !== null && canSplit(draft, ctx) && splitRemaining(draft, ctx.money) !== 0
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const result = buildTransactionInput(draft, ctx);
		if (!result.ok) {
			error = { message: FORM_ERRORS[result.error]() };
			return;
		}
		const input = result.input;
		const count = installable ? installmentCount(draft, ctx, installments) : 1;
		if (count === null) {
			error = { message: FORM_ERRORS.INSTALLMENTS_INVALID() };
			return;
		}
		// A year typed wrong would stretch every budget computation to it: ask once.
		if (isFarFuture(input.date, todayIso()) && farDate !== input.date) {
			farDate = input.date;
			return;
		}
		busy = true;
		error = await runAction(async () => {
			// Categories picked by a new name are created first, then used by their ids.
			const ids = await pending.resolve(session.api, categoryValues(input));
			const saved = withCategoryIds(input, ids);
			await (onSave
				? onSave(saved)
				: editingId
					? session.api.transactions.update(editingId, saved)
					: count > 1
						? session.api.schedules.createInstallments(saved, count)
						: session.api.transactions.create(saved));
		});
		busy = false;
		if (!error) onDone(input.accountId);
	}

	function confirm(next: boolean) {
		confirming = next;
		error = null;
	}

	async function remove() {
		if (!editingId || busy) return;
		const id = editingId;
		busy = true;
		const call = session.api.transactions.delete(id);
		error = await runAction(() => call);
		busy = false;
		if (error) return;
		onDone(null);
		offerUndo(session.client, call, m.transaction_deleted());
	}
</script>

{#if confirming}
	<ConfirmPanel
		body={m.transaction_delete_body()}
		confirmLabel={m.delete()}
		{error}
		{busy}
		onCancel={() => confirm(false)}
		onConfirm={remove}
	/>
{:else}
	<form class="grid gap-4" onsubmit={save}>
		<TransactionFields {ctx} bind:draft dateLabel={m.transaction_date()} {pending} />

		{#if installable}
			<div class="grid gap-2">
				<Label for="txn-installments">{m.transaction_installments()}</Label>
				<div class="flex items-center gap-3">
					<Input
						id="txn-installments"
						class="w-20"
						bind:value={installments}
						inputmode="numeric"
						autocomplete="off"
						placeholder="1"
					/>
					{#if plan}
						<span class="text-sm text-muted-foreground tabular-nums" data-testid="installment-plan">
							{planText}
						</span>
					{/if}
				</div>
			</div>
		{/if}

		{#if reconciled}
			<Alert.Root data-testid="reconciled-notice">
				<Alert.Description>{m.transaction_reconciled_notice()}</Alert.Description>
			</Alert.Root>
		{/if}

		<div class="flex items-center gap-2">
			<Checkbox id="txn-cleared" bind:checked={draft.cleared} disabled={lockedCleared} />
			<Label for="txn-cleared">{m.transaction_cleared()}</Label>
		</div>

		{#if askingFar}
			<Alert.Root data-testid="far-future">
				<Alert.Description>
					{m.date_far_future({ date: formatDate(draft.date, getLocale()) })}
				</Alert.Description>
			</Alert.Root>
		{/if}

		{#if editingId}
			<div class="-mx-2 grid">
				<SheetLink
					icon={Trash2Icon}
					label={m.transaction_delete()}
					destructive
					onclick={() => confirm(true)}
				/>
			</div>
		{/if}

		<FormMessage {error} />

		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" onclick={() => onDone(null)}>{m.cancel()}</Button>
			<Button type="submit" disabled={busy || blocked}>
				{askingFar ? m.save_anyway() : m.save()}
			</Button>
		</div>
	</form>
{/if}
