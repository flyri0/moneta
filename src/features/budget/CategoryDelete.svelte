<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Label } from '$ui/label';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction } from '$client/notify';
	import { moveTargets, type GridModel } from '$features/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import { errorMessage } from '$i18n/errors';
	import { groupLabel } from '$i18n/labels';
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
		isIncome
			? (incomeGroup?.categories
					.filter((c) => c.id !== category.id)
					.map((c) => ({ value: c.id, label: c.name })) ?? [])
			: moveTargets(model, category.id)
					.filter((t) => !t.group.system)
					.map((t) => ({ value: t.id, label: `${groupLabel(t.group)} · ${t.name}` }))
	);

	let reassignTo = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	const used = $derived(usage.data?.used ?? false);
	const ready = $derived(usage.data !== undefined && (!used || reassignTo !== ''));

	async function remove() {
		if (!ready || busy) return;
		busy = true;
		error = await runAction(() =>
			session.api.categories.delete(category.id, used ? reassignTo : undefined)
		);
		busy = false;
		if (!error) onDone();
	}
</script>

<div class="grid gap-4">
	{#if usage.error}
		<p class="text-sm text-destructive" role="alert">{errorMessage(usage.error)}</p>
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
			<Combobox
				id="category-reassign"
				class="w-full"
				ariaLabel={m.category_delete_move_to()}
				items={targets}
				bind:value={reassignTo}
				placeholder={m.category_delete_choose()}
			/>
		</div>
	{/if}

	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" onclick={onCancel}>{m.cancel()}</Button>
		<Button variant="destructive" disabled={!ready || busy} onclick={remove}>
			{m.category_delete()}
		</Button>
	</div>
</div>
