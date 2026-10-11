<script lang="ts">
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Label } from '$ui/label';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import CategoryCombobox from '$features/categories/CategoryCombobox.svelte';
	import { NewCategories } from '$features/categories/new-categories';
	import { categoryOptions, newCategoryGroups, newDraft } from '$features/transactions/form';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, runAction, type ActionError } from '$client/notify';
	import { submitOnce } from '$client/submit.svelte';
	import { offerUndo } from '$client/undo';
	import type { Account } from '$db/repos/accounts';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	/** Transfers any remaining balance before closing, with a quiet path to deletion. */
	let {
		account,
		onCancel,
		onClosed,
		onDelete
	}: { account: Account; onCancel: () => void; onClosed: () => void; onDelete: () => void } =
		$props();
	const session = useSession();
	const accounts = useLive(session.client, ['accounts', 'transactions'], () =>
		session.api.accounts.list()
	);
	const tree = useLive(session.client, ['category_groups', 'categories'], () =>
		session.api.categories.tree()
	);
	const pending = new NewCategories();
	let toAccountId = $state('');
	let categoryId = $state('');
	let error = $state<ActionError | null>(null);

	// The settings account is dated today; closing moves future transactions' money too.
	const balance = $derived(
		accounts.data?.find((a) => a.id === account.id)?.balance ?? account.balance + account.upcoming
	);
	const moving = $derived(balance !== 0);
	const targets = $derived((accounts.data ?? []).filter((a) => !a.closed && a.id !== account.id));
	const target = $derived(targets.find((a) => a.id === toAccountId) ?? null);
	const needsCategory = $derived(target !== null && target.onBudget !== account.onBudget);
	const ctx = $derived({
		accounts: accounts.data ?? [account],
		payees: [],
		tree: tree.data ?? [],
		money: session.money
	});
	const draft = $derived({
		...newDraft(account.id, todayIso()),
		transferAccountId: toAccountId,
		categoryId,
		direction: balance > 0 ? ('outflow' as const) : ('inflow' as const)
	});
	const options = $derived(categoryOptions(draft, ctx));
	const newIn = $derived(newCategoryGroups(draft, ctx));
	const loadError = $derived(accounts.error ?? (needsCategory ? tree.error : undefined));

	const close = submitOnce(async () => {
		if (moving && !target) {
			error = { message: m.form_error_account_required() };
			return;
		}
		if (moving && needsCategory && !categoryId) {
			error = { message: m.error_category_required() };
			return;
		}
		let call: Promise<unknown> | null = null;
		error = await runAction(async () => {
			const ids = await pending.resolve(session.api, moving && needsCategory ? [categoryId] : []);
			call = session.api.accounts.closeWithTransfer(account.id, {
				toAccountId,
				categoryId: moving && needsCategory ? (ids.get(categoryId) ?? categoryId) : null,
				date: todayIso()
			});
			await call;
		});
		if (error || !call) return;
		offerUndo(session.client, call, m.account_closed());
		onClosed();
	});
</script>

<div
	class="grid gap-4 transition-opacity aria-busy:opacity-60 aria-busy:delay-150"
	aria-busy={accounts.stale || (needsCategory && tree.stale)}
>
	{#if moving}
		<p class="text-sm text-muted-foreground">
			{m.account_close_transfer_hint({ amount: session.format(Math.abs(balance)) })}
		</p>
		{#if accounts.data === undefined && !accounts.error}
			<LoadingRows rows={1} />
		{:else}
			<div class="grid gap-2">
				<Label for="close-to">{m.account_close_transfer_to()}</Label>
				<Combobox
					id="close-to"
					ariaLabel={m.account_close_transfer_to()}
					bind:value={toAccountId}
					items={targets.map((a) => ({ value: a.id, label: a.name }))}
					placeholder={m.account_close_transfer_to()}
				/>
			</div>
		{/if}
		{#if needsCategory}
			{#if tree.data === undefined && !tree.error}
				<LoadingRows rows={1} />
			{:else}
				<div class="grid gap-2">
					<Label for="close-category">{m.transaction_category()}</Label>
					<CategoryCombobox
						id="close-category"
						ariaLabel={m.transaction_category()}
						tree={ctx.tree}
						{options}
						{newIn}
						{pending}
						value={categoryId}
						onSelect={(id) => (categoryId = id)}
						allowEmpty={false}
					/>
				</div>
			{/if}
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">{m.account_close_zero_body()}</p>
	{/if}
	<FormMessage {error} values={[toAccountId, categoryId]} />
	<FormMessage error={!error && loadError ? actionError(loadError) : null} />
	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" disabled={close.pending} onclick={onCancel}>{m.cancel()}</Button>
		<Button disabled={close.pending} onclick={close.run}>
			{moving ? m.account_close_transfer_confirm() : m.account_close()}
		</Button>
	</div>
	<button
		type="button"
		class="justify-self-center text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
		disabled={close.pending}
		onclick={onDelete}
	>
		{m.account_delete_all()}
	</button>
</div>
