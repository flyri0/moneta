<script lang="ts">
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Label } from '$ui/label';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
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
	import TransactionFields from './TransactionFields.svelte';

	/** `onSave`, when given, replaces the create/update write (entering a scheduled occurrence). */
	let {
		ctx,
		initial,
		editingId,
		onSave,
		confirming = $bindable(false),
		onDone
	}: {
		ctx: FormContext;
		initial: TransactionDraft;
		editingId: string | null;
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
	/** A date years ahead the user was asked about: saving it again goes ahead. */
	let farDate = $state<string | null>(null);
	const askingFar = $derived(farDate !== null && farDate === draft.date);

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
		// A year typed wrong would stretch every budget computation to it: ask once.
		if (isFarFuture(input.date, todayIso()) && farDate !== input.date) {
			farDate = input.date;
			return;
		}
		busy = true;
		error = await runAction(() =>
			onSave
				? onSave(input)
				: editingId
					? session.api.transactions.update(editingId, input)
					: session.api.transactions.create(input)
		);
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
		error = await runAction(() => session.api.transactions.delete(id));
		busy = false;
		if (!error) onDone(null);
	}
</script>

{#if confirming}
	<ConfirmPanel
		body={m.confirm_cannot_undo()}
		confirmLabel={m.delete()}
		{error}
		{busy}
		onCancel={() => confirm(false)}
		onConfirm={remove}
	/>
{:else}
	<form class="grid gap-4" onsubmit={save}>
		<TransactionFields {ctx} bind:draft dateLabel={m.transaction_date()} />

		<div class="flex items-center gap-2">
			<Checkbox id="txn-cleared" bind:checked={draft.cleared} />
			<Label for="txn-cleared">{m.transaction_cleared()}</Label>
		</div>

		{#if askingFar}
			<Alert.Root data-testid="far-future">
				<Alert.Description>
					{m.date_far_future({ date: formatDate(draft.date, getLocale()) })}
				</Alert.Description>
			</Alert.Root>
		{/if}

		<FormMessage {error} />

		<div class="flex flex-wrap justify-end gap-2">
			{#if editingId}
				<Button variant="destructive" class="mr-auto" onclick={() => confirm(true)}>
					{m.delete()}
				</Button>
			{/if}
			<Button variant="ghost" onclick={() => onDone(null)}>{m.cancel()}</Button>
			<Button type="submit" disabled={busy || blocked}>
				{askingFar ? m.save_anyway() : m.save()}
			</Button>
		</div>
	</form>
{/if}
