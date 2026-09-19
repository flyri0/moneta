<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		NativeSelect,
		NativeSelectOptGroup,
		NativeSelectOption
	} from '$lib/components/ui/native-select';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { groupLabel, categoryLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import {
		buildTransactionInput,
		canSplit,
		categoryMode,
		categoryOptions,
		splitRemaining,
		suggestCategory,
		transferTarget,
		transferTargets,
		type FormContext,
		type FormError,
		type TransactionDraft
	} from '$lib/transactions/form';

	let {
		ctx,
		initial,
		editingId,
		onDone
	}: {
		ctx: FormContext;
		initial: TransactionDraft;
		editingId: string | null;
		onDone: (savedAccountId: string | null) => void;
	} = $props();

	const session = useSession();
	// The dialog re-creates this form (with {#key}) for every transaction it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(initial));
	let error = $state<string | null>(null);
	let busy = $state(false);
	let confirmDelete = $state(false);

	const openAccounts = $derived(ctx.accounts.filter((a) => !a.closed || a.id === draft.accountId));
	const mode = $derived(categoryMode(draft, ctx));
	const options = $derived(categoryOptions(draft, ctx));
	const splittable = $derived(canSplit(draft, ctx));
	const remaining = $derived(draft.splits ? splitRemaining(draft, ctx.money) : 0);
	const isTransfer = $derived(transferTarget(draft, ctx) !== null);

	const FORM_ERRORS: Record<FormError, () => string> = {
		ACCOUNT_REQUIRED: m.form_error_account_required,
		DATE_INVALID: m.form_error_date_invalid,
		AMOUNT_INVALID: m.form_error_amount_invalid,
		CATEGORY_REQUIRED: m.error_category_required,
		SPLIT_LINE_INVALID: m.form_error_split_line_invalid,
		SPLIT_TOO_FEW_LINES: m.error_split_too_few_lines,
		SPLIT_SUM_MISMATCH: m.error_split_sum_mismatch
	};

	function payeeChanged() {
		if (mode === 'hidden' || draft.categoryId) return;
		draft.categoryId = suggestCategory(draft, ctx) ?? '';
	}

	function startSplit() {
		draft.splits = [
			{ categoryId: draft.categoryId, amount: draft.amount, memo: '' },
			{ categoryId: '', amount: '', memo: '' }
		];
		draft.categoryId = '';
	}

	function removeLine(index: number) {
		if (!draft.splits) return;
		draft.splits.splice(index, 1);
		if (draft.splits.length === 0) draft.splits = null;
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const result = buildTransactionInput(draft, ctx);
		if (!result.ok) {
			error = FORM_ERRORS[result.error]();
			return;
		}
		busy = true;
		error = await runAction(() =>
			editingId
				? session.api.transactions.update(editingId, result.input)
				: session.api.transactions.create(result.input)
		);
		busy = false;
		if (!error) onDone(result.input.accountId);
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

{#snippet categorySelect(value: string, onChange: (id: string) => void, id: string, label: string)}
	<NativeSelect
		{id}
		class="w-full"
		{value}
		aria-label={label}
		onchange={(e) => onChange(e.currentTarget.value)}
	>
		<NativeSelectOption value="">
			{mode === 'optional' ? m.transaction_no_category() : m.transaction_choose_category()}
		</NativeSelectOption>
		{#each options as group (group.id)}
			<NativeSelectOptGroup label={groupLabel(group)}>
				{#each group.categories as category (category.id)}
					<NativeSelectOption value={category.id}>{categoryLabel(category)}</NativeSelectOption>
				{/each}
			</NativeSelectOptGroup>
		{/each}
	</NativeSelect>
{/snippet}

<form class="grid gap-4" onsubmit={save}>
	<div class="grid grid-cols-2 gap-3">
		<div class="grid gap-2">
			<Label for="txn-account">{m.transaction_account()}</Label>
			<NativeSelect id="txn-account" class="w-full" bind:value={draft.accountId}>
				{#each openAccounts as account (account.id)}
					<NativeSelectOption value={account.id}>{account.name}</NativeSelectOption>
				{/each}
			</NativeSelect>
		</div>
		<div class="grid gap-2">
			<Label for="txn-date">{m.transaction_date()}</Label>
			<Input id="txn-date" type="date" bind:value={draft.date} required />
		</div>
	</div>

	<div class="grid gap-2">
		<Label for="txn-payee">{m.transaction_payee()}</Label>
		<Input
			id="txn-payee"
			list="txn-payees"
			autocomplete="off"
			bind:value={draft.payee}
			onchange={payeeChanged}
		/>
		<datalist id="txn-payees">
			{#each transferTargets(draft, ctx) as account (account.id)}
				<option value={ctx.transferLabel(account.name)}></option>
			{/each}
			{#each ctx.payees as payee (payee.id)}
				<option value={payee.name}></option>
			{/each}
		</datalist>
	</div>

	<div class="grid gap-2">
		<span class="text-sm font-medium">{m.transaction_amount()}</span>
		<div class="grid grid-cols-[auto_1fr] gap-2">
			<div class="flex rounded-md border p-0.5" role="group" aria-label={m.transaction_direction()}>
				<Button
					size="sm"
					variant={draft.direction === 'outflow' ? 'secondary' : 'ghost'}
					aria-pressed={draft.direction === 'outflow'}
					onclick={() => (draft.direction = 'outflow')}>{m.transaction_outflow()}</Button
				>
				<Button
					size="sm"
					variant={draft.direction === 'inflow' ? 'secondary' : 'ghost'}
					aria-pressed={draft.direction === 'inflow'}
					onclick={() => (draft.direction = 'inflow')}>{m.transaction_inflow()}</Button
				>
			</div>
			<Input
				id="txn-amount"
				bind:value={draft.amount}
				inputmode="decimal"
				autocomplete="off"
				aria-label={m.transaction_amount()}
				placeholder="0"
				required
			/>
		</div>
	</div>

	{#if mode !== 'hidden'}
		<div class="grid gap-2">
			<Label for="txn-category">{m.transaction_category()}</Label>
			<div class="flex gap-2">
				{@render categorySelect(
					draft.categoryId,
					(id) => (draft.categoryId = id),
					'txn-category',
					m.transaction_category()
				)}
				{#if splittable && !isTransfer}
					<Button variant="outline" onclick={startSplit}>{m.transaction_split()}</Button>
				{/if}
			</div>
		</div>
	{/if}

	{#if draft.splits && splittable}
		<fieldset class="grid gap-2 rounded-md border p-3">
			<legend class="px-1 text-sm font-medium">{m.transaction_split_lines()}</legend>
			{#each draft.splits as line, i (i)}
				<div class="grid grid-cols-[1fr_7rem_auto] gap-2">
					{@render categorySelect(
						line.categoryId,
						(id) => (line.categoryId = id),
						`txn-split-${i}`,
						m.transaction_split_category({ line: i + 1 })
					)}
					<Input
						bind:value={line.amount}
						inputmode="decimal"
						autocomplete="off"
						aria-label={m.transaction_split_amount({ line: i + 1 })}
					/>
					<Button
						variant="ghost"
						size="icon"
						aria-label={m.transaction_split_remove({ line: i + 1 })}
						onclick={() => removeLine(i)}><XIcon /></Button
					>
					<Input
						class="col-span-3"
						bind:value={line.memo}
						placeholder={m.transaction_memo()}
						aria-label={m.transaction_split_memo({ line: i + 1 })}
					/>
				</div>
			{/each}
			<div class="flex items-center justify-between gap-2">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => draft.splits?.push({ categoryId: '', amount: '', memo: '' })}
				>
					<PlusIcon />{m.transaction_split_add()}
				</Button>
				<span
					class="text-sm tabular-nums {remaining === 0
						? 'text-muted-foreground'
						: 'text-destructive'}"
					data-testid="split-remaining"
				>
					{remaining === null
						? m.form_error_amount_invalid()
						: m.transaction_split_remaining({ amount: session.format(Math.abs(remaining)) })}
				</span>
			</div>
		</fieldset>
	{/if}

	<div class="grid gap-2">
		<Label for="txn-memo">{m.transaction_memo()}</Label>
		<Input id="txn-memo" bind:value={draft.memo} autocomplete="off" />
	</div>

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
		<Button
			type="submit"
			disabled={busy || (draft.splits !== null && splittable && remaining !== 0)}
		>
			{m.save()}
		</Button>
	</div>
</form>
