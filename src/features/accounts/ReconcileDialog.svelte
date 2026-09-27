<script lang="ts">
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import CategoryCombobox from '$features/transactions/CategoryCombobox.svelte';
	import { NewCategories } from '$features/transactions/new-categories';
	import { isDebtType } from '$features/accounts/account-form';
	import { checkBalance, shownBalance } from '$features/accounts/reconcile';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { Account } from '$db/repos/accounts';
	import { formatAmountInput } from '$domain/money';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Reconciles an account: the user confirms the cleared balance matches the bank's, or types the
	 * bank's; a difference can be entered as an adjustment. `statement` starts from a balance read
	 * off an imported statement.
	 */
	let {
		open = $bindable(false),
		account,
		statement = null
	}: {
		open: boolean;
		account: Account;
		statement?: { balance: number; date: string } | null;
	} = $props();

	const session = useSession();
	const tree = useLive(session.client, ['categories', 'category_groups'], () =>
		session.api.categories.tree()
	);

	type Step = 'ask' | 'enter' | 'difference';
	let step = $state<Step>('ask');
	let date = $state('');
	let typed = $state('');
	let difference = $state(0);
	let balance = $state(0);
	let categoryId = $state('');
	let busy = $state(false);
	const pending = new NewCategories();
	let error = $state<ActionError | null>(null);

	const debt = $derived(isDebtType(account.type));
	const cleared = $derived(shownBalance(account.type, account.clearedBalance));

	$effect(() => {
		if (!open) return;
		error = null;
		categoryId = '';
		date = statement?.date ?? todayIso();
		typed = statement
			? formatAmountInput(shownBalance(account.type, statement.balance), session.money)
			: '';
		step = statement ? 'enter' : 'ask';
	});

	async function reconcile(input: Parameters<typeof session.api.accounts.reconcile>[1]) {
		busy = true;
		error = await runAction(async () => {
			// A category picked by a new name is created first.
			const adjustment = input.adjustment;
			const ids = await pending.resolve(session.api, [adjustment?.categoryId]);
			const categoryId = adjustment?.categoryId
				? (ids.get(adjustment.categoryId) ?? adjustment.categoryId)
				: null;
			await session.api.accounts.reconcile(
				account.id,
				adjustment ? { ...input, adjustment: { ...adjustment, categoryId } } : input
			);
		});
		busy = false;
		if (!error) open = false;
	}

	function check(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		const result = checkBalance(account.type, session.parse(typed), account.clearedBalance);
		if (result.kind === 'invalid') {
			error = { message: m.form_error_amount_invalid() };
		} else if (result.kind === 'match') {
			void reconcile({ date, balance: result.balance });
		} else {
			balance = result.balance;
			difference = result.difference;
			step = 'difference';
		}
	}

	function adjust() {
		void reconcile({
			date,
			balance,
			adjustment: {
				categoryId: account.onBudget ? categoryId || null : null,
				memo: m.reconcile_adjustment_memo()
			}
		});
	}

	function back() {
		step = step === 'difference' ? 'enter' : 'ask';
		error = null;
	}
</script>

<ResponsiveDialog
	bind:open
	title={m.reconcile_title({ account: account.name })}
	onBack={step === 'ask' || (step === 'enter' && statement) ? undefined : back}
>
	{#if step === 'ask'}
		<div class="grid gap-4">
			<div class="grid gap-1 text-center">
				<p class="text-sm text-muted-foreground">
					{debt ? m.reconcile_ask_owed() : m.reconcile_ask()}
				</p>
				<p class="text-3xl font-bold tracking-tight tabular-nums" data-testid="reconcile-cleared">
					{session.format(cleared)}
				</p>
			</div>
			<FormMessage {error} />
			<div class="grid grid-cols-2 gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (step = 'enter')}>
					{m.reconcile_no()}
				</Button>
				<Button
					disabled={busy}
					onclick={() => void reconcile({ date, balance: account.clearedBalance })}
				>
					{m.reconcile_yes()}
				</Button>
			</div>
		</div>
	{:else if step === 'enter'}
		<form class="grid gap-4" onsubmit={check}>
			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-2">
					<Label for="reconcile-balance">
						{debt ? m.reconcile_bank_owed() : m.reconcile_bank_balance()}
					</Label>
					<Input
						id="reconcile-balance"
						bind:value={typed}
						inputmode="decimal"
						autocomplete="off"
						placeholder="0"
						required
					/>
				</div>
				<div class="grid gap-2">
					<Label for="reconcile-date">{m.reconcile_date()}</Label>
					<DatePicker id="reconcile-date" bind:value={date} required />
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				{m.reconcile_cleared_now({ amount: session.format(cleared) })}
			</p>
			<FormMessage {error} />
			<Button type="submit" disabled={busy}>{m.reconcile_continue()}</Button>
		</form>
	{:else}
		<ConfirmPanel
			body={m.reconcile_difference_body()}
			confirmLabel={m.reconcile_adjust()}
			destructive={false}
			disabled={account.onBudget && !categoryId}
			{error}
			{busy}
			onCancel={() => (open = false)}
			onConfirm={adjust}
		>
			<div class="grid gap-1 rounded-lg border p-3 text-center">
				<span class="text-xs text-muted-foreground">{m.reconcile_difference()}</span>
				<span class="text-xl font-semibold tabular-nums" data-testid="reconcile-difference">
					{session.format(difference)}
				</span>
			</div>
			{#if account.onBudget}
				<div class="grid gap-2">
					<Label for="reconcile-category">{m.reconcile_adjustment_category()}</Label>
					<CategoryCombobox
						id="reconcile-category"
						tree={tree.data ?? []}
						{pending}
						bind:value={categoryId}
						ariaLabel={m.reconcile_adjustment_category()}
					/>
				</div>
			{/if}
		</ConfirmPanel>
	{/if}
</ResponsiveDialog>
