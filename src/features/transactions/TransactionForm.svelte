<script lang="ts">
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Label } from '$ui/label';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import type { TransactionInput } from '$db/repos/transactions';
	import { m } from '$i18n/paraglide/messages';
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
		onDone
	}: {
		ctx: FormContext;
		initial: TransactionDraft;
		editingId: string | null;
		onSave?: (input: TransactionInput) => Promise<unknown>;
		onDone: (savedAccountId: string | null) => void;
	} = $props();

	const session = useSession();
	// The dialog re-creates this form (with {#key}) for every transaction it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(initial));
	let error = $state<string | null>(null);
	let busy = $state(false);
	let confirmDelete = $state(false);

	/** Split lines that don't add up yet keep Save disabled. */
	const blocked = $derived(
		draft.splits !== null && canSplit(draft, ctx) && splitRemaining(draft, ctx.money) !== 0
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const result = buildTransactionInput(draft, ctx);
		if (!result.ok) {
			error = FORM_ERRORS[result.error]();
			return;
		}
		const input = result.input;
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

	async function remove() {
		if (!editingId) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		const id = editingId;
		error = await runAction(() => session.api.transactions.delete(id));
		if (!error) onDone(null);
	}
</script>

<form class="grid gap-4" onsubmit={save}>
	<TransactionFields {ctx} bind:draft dateLabel={m.transaction_date()} />

	<div class="flex items-center gap-2">
		<Checkbox id="txn-cleared" bind:checked={draft.cleared} />
		<Label for="txn-cleared">{m.transaction_cleared()}</Label>
	</div>

	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

	<div class="flex flex-wrap justify-end gap-2">
		{#if editingId}
			<Button variant="destructive" class="mr-auto" onclick={remove}>
				{confirmDelete ? m.confirm_delete() : m.delete()}
			</Button>
		{/if}
		<Button variant="ghost" onclick={() => onDone(null)}>{m.cancel()}</Button>
		<Button type="submit" disabled={busy || blocked}>{m.save()}</Button>
	</div>
</form>
