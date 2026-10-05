<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$ui/alert';
	import { Label } from '$ui/label';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import CategoryCombobox from '$features/categories/CategoryCombobox.svelte';
	import { NewCategories } from '$features/categories/new-categories';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction, type ActionError, actionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import { moveTargets, type GridModel } from '$features/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Confirms deleting a category. It says what uses the category and, when something does, asks
	 * where its transactions and money go.
	 */
	let {
		category,
		groups,
		model,
		onCancel,
		onDone
	}: {
		category: BudgetCategoryView;
		groups: BudgetGroupView[];
		model: GridModel;
		onCancel: () => void;
		onDone: () => void;
	} = $props();

	const session = useSession();
	const usage = useLive(
		session.client,
		['transactions', 'transaction_splits', 'budget_assignments'],
		() => session.api.categories.usage(category.id)
	);

	const incomeGroup = $derived(groups.find((g) => g.system === 'income'));
	const isIncome = $derived(incomeGroup?.categories.some((c) => c.id === category.id) ?? false);
	const targets = $derived(
		isIncome && incomeGroup
			? [{ ...incomeGroup, categories: incomeGroup.categories.filter((c) => c.id !== category.id) }]
			: moveTargets(model, category.id)
	);
	/** The groups a category created to take this one's place can go in. */
	const userGroups = $derived(groups.filter((g) => !g.system && !g.hidden));
	const pending = new NewCategories();

	let reassignTo = $state('');
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	const used = $derived(usage.data?.used ?? false);
	const ready = $derived(usage.data !== undefined && (!used || reassignTo !== ''));

	async function remove() {
		if (!ready || busy) return;
		busy = true;
		let call: Promise<void> | undefined;
		error = await runAction(async () => {
			let target: string | undefined;
			if (used) {
				// A category picked by a new name is created first.
				const ids = await pending.resolve(session.api, [reassignTo]);
				target = ids.get(reassignTo) ?? reassignTo;
			}
			call = session.api.categories.delete(category.id, target);
			await call;
		});
		busy = false;
		if (error) return;
		onDone();
		if (call) offerUndo(session.client, call, m.category_deleted());
	}
</script>

<ConfirmPanel
	confirmLabel={m.category_delete()}
	{error}
	{busy}
	disabled={!ready}
	{onCancel}
	onConfirm={remove}
>
	{#if usage.error}
		<FormMessage error={actionError(usage.error)} />
	{:else if usage.data && !used}
		<p class="text-sm text-muted-foreground">{m.category_delete_unused()}</p>
	{:else if usage.data}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon class="size-4" />
			<Alert.Title>{m.category_delete_in_use()}</Alert.Title>
			<Alert.Description>
				<p>{m.category_delete_in_use_body()}</p>
				<dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
					<dt>{m.category_delete_transactions()}</dt>
					<dd class="text-right font-medium">{usage.data.transactions}</dd>
					{#if !isIncome}
						<dt>{m.budget_available()}</dt>
						<dd class="text-right font-medium">{session.format(category.available)}</dd>
					{/if}
				</dl>
			</Alert.Description>
		</Alert.Root>
		<div class="grid gap-2">
			<Label for="category-reassign">{m.category_delete_move_to()}</Label>
			<CategoryCombobox
				id="category-reassign"
				class="w-full"
				ariaLabel={m.category_delete_move_to()}
				tree={groups}
				options={targets}
				newIn={userGroups}
				{pending}
				bind:value={reassignTo}
				emptyLabel={m.category_delete_choose()}
				allowEmpty={false}
				creatable={!isIncome}
			/>
		</div>
	{/if}
</ConfirmPanel>
