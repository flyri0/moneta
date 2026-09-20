<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { Separator } from '$lib/components/ui/separator';
	import ResponsiveDialog from '$lib/components/ResponsiveDialog.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { categoryProgress } from '$lib/budget/progress';
	import { moveTargets, type GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$lib/db/repos/budget';
	import { formatAmountInput } from '$lib/domain/money';
	import type { Month } from '$lib/domain/month';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';
	import CategorySettings from './CategorySettings.svelte';
	import QuickAssignButtons from './QuickAssignButtons.svelte';

	let {
		open = $bindable(false),
		category,
		month,
		model,
		groups
	}: {
		open: boolean;
		category: BudgetCategoryView;
		month: Month;
		model: GridModel;
		groups: BudgetGroupView[];
	} = $props();

	const session = useSession();

	let assignedText = $state('');
	let moveAmount = $state('');
	let moveDirection = $state<'to' | 'from'>('to');
	let otherId = $state('');
	let error = $state<string | null>(null);

	const targets = $derived(moveTargets(model, category.id));
	const progress = $derived(categoryProgress(category));

	// Reset the form each time the sheet opens for a category.
	$effect(() => {
		if (!open) return;
		assignedText = formatAmountInput(category.assigned, session.money);
		moveAmount = '';
		otherId = '';
		error = null;
	});

	async function saveAssigned(event: SubmitEvent) {
		event.preventDefault();
		const value = assignedText.trim() === '' ? 0 : session.parse(assignedText);
		if (value === null) {
			error = m.form_error_amount_invalid();
			return;
		}
		error = await runAction(() => session.api.budget.setAssigned(category.id, month, value));
		if (!error) open = false;
	}

	async function move(event: SubmitEvent) {
		event.preventDefault();
		const amount = session.parse(moveAmount);
		if (amount === null || amount <= 0) {
			error = m.form_error_amount_invalid();
			return;
		}
		if (!otherId) {
			error = m.budget_move_choose_category();
			return;
		}
		const [fromCategoryId, toCategoryId] =
			moveDirection === 'to' ? [category.id, otherId] : [otherId, category.id];
		error = await runAction(() =>
			session.api.budget.moveMoney({ fromCategoryId, toCategoryId, month, amount })
		);
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open title={category.name}>
	<div class="grid gap-5">
		<div class="grid gap-1">
			<div class="flex items-center justify-between text-sm">
				<span class="text-muted-foreground">{m.budget_available()}</span>
				<AvailablePill {category} />
			</div>
			<p class="text-xs text-muted-foreground tabular-nums">
				{m.budget_progress_spent({
					spent: session.format(progress.spent),
					funded: session.format(progress.funded)
				})}
			</p>
		</div>

		<form class="grid gap-2" onsubmit={saveAssigned}>
			<Label for="sheet-assigned">{m.budget_assigned_this_month()}</Label>
			<div class="flex gap-2">
				<Input
					id="sheet-assigned"
					bind:value={assignedText}
					inputmode="decimal"
					autocomplete="off"
				/>
				<Button type="submit">{m.save()}</Button>
			</div>
		</form>

		<Separator />

		<form class="grid gap-2" onsubmit={move}>
			<h3 class="text-sm font-medium">{m.budget_move_money()}</h3>
			<div class="grid grid-cols-2 gap-2">
				<Button
					variant={moveDirection === 'to' ? 'secondary' : 'ghost'}
					aria-pressed={moveDirection === 'to'}
					onclick={() => (moveDirection = 'to')}>{m.budget_move_to()}</Button
				>
				<Button
					variant={moveDirection === 'from' ? 'secondary' : 'ghost'}
					aria-pressed={moveDirection === 'from'}
					onclick={() => (moveDirection = 'from')}>{m.budget_move_from()}</Button
				>
			</div>
			<div class="grid min-w-0 grid-cols-[1fr_7rem] gap-2">
				<NativeSelect
					class="w-full min-w-0"
					bind:value={otherId}
					aria-label={m.budget_move_other()}
				>
					<NativeSelectOption value="">{m.budget_move_other()}</NativeSelectOption>
					{#each targets as target (target.id)}
						<NativeSelectOption value={target.id}
							>{groupLabel(target.group)} · {target.name}</NativeSelectOption
						>
					{/each}
				</NativeSelect>
				<Input
					bind:value={moveAmount}
					inputmode="decimal"
					autocomplete="off"
					aria-label={m.budget_move_amount()}
					placeholder="0"
				/>
			</div>
			<Button type="submit" variant="outline">{m.budget_move()}</Button>
		</form>

		{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

		<Separator />

		<QuickAssignButtons categoryIds={[category.id]} {month} onDone={() => (open = false)} />

		<Separator />

		<CategorySettings {category} {groups} {model} onDone={() => (open = false)} />
	</div>
</ResponsiveDialog>
