<script lang="ts">
	import { untrack } from 'svelte';
	import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Combobox } from '$ui/combobox';
	import { Separator } from '$ui/separator';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction } from '$client/notify';
	import { categoryProgress } from '$features/budget/progress';
	import { moveTargets, type GridModel } from '$features/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import { formatAmountInput } from '$domain/money';
	import type { Month } from '$domain/month';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';
	import CategoryDelete from './CategoryDelete.svelte';
	import CategorySettings from './CategorySettings.svelte';
	import QuickAssignButtons from './QuickAssignButtons.svelte';
	import SheetLink from './SheetLink.svelte';

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

	/** The sheet's screen: the money first, the rest one tap away. */
	let view = $state<'main' | 'move' | 'settings' | 'delete'>('main');
	let assignedText = $state('');
	let moveAmount = $state('');
	let moveDirection = $state<'to' | 'from'>('to');
	let otherId = $state('');
	let error = $state<string | null>(null);

	const isIncome = $derived(
		groups.find((g) => g.categories.some((c) => c.id === category.id))?.system === 'income'
	);
	const targets = $derived(isIncome ? [] : moveTargets(model, category.id));
	const targetItems = $derived(
		targets.map((t) => ({ value: t.id, label: `${groupLabel(t.group)} · ${t.name}` }))
	);
	const progress = $derived(categoryProgress(category));
	const title = $derived(
		{
			main: category.name,
			move: m.budget_move_money(),
			settings: m.category_settings(),
			delete: m.category_delete_title({ name: category.name })
		}[view]
	);

	// A derived id changes only when the category does, not on every refresh of the same category.
	const categoryId = $derived(category.id);

	// Reset the form when the sheet opens or switches category. Only `open` and the category's id
	// are tracked: a live-query refresh of the month must not wipe what is being typed.
	$effect(() => {
		if (!open) return;
		void categoryId;
		untrack(() => {
			view = 'main';
			assignedText = formatAmountInput(category.assigned, session.money);
			moveAmount = '';
			otherId = '';
			error = null;
		});
	});

	function go(next: typeof view) {
		view = next;
		moveAmount = '';
		otherId = '';
		error = null;
	}

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

<ResponsiveDialog bind:open {title} onBack={view === 'main' ? undefined : () => go('main')}>
	{#if view === 'main'}
		<div class="grid gap-5">
			{#if isIncome}
				<div class="flex items-center justify-between text-sm">
					<span class="text-muted-foreground">{m.budget_activity()}</span>
					<span class="text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
						{session.format(category.activity)}
					</span>
				</div>
			{:else}
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
					{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
				</form>

				<QuickAssignButtons categoryIds={[category.id]} {month} onDone={() => (open = false)} />
			{/if}

			<Separator />

			<nav class="-mx-2 grid gap-0.5">
				{#if !isIncome}
					<SheetLink
						icon={ArrowLeftRightIcon}
						label={m.budget_move_money()}
						onclick={() => go('move')}
					/>
				{/if}
				<SheetLink
					icon={SettingsIcon}
					label={m.category_settings()}
					onclick={() => go('settings')}
				/>
				<SheetLink
					icon={Trash2Icon}
					label={m.category_delete()}
					destructive
					onclick={() => go('delete')}
				/>
			</nav>
		</div>
	{:else if view === 'move'}
		<form class="grid gap-3" onsubmit={move}>
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
				<Combobox
					class="w-full min-w-0"
					items={targetItems}
					emptyOption={{ value: '', label: m.budget_move_other() }}
					bind:value={otherId}
					placeholder={m.budget_move_other()}
					ariaLabel={m.budget_move_other()}
				/>
				<Input
					bind:value={moveAmount}
					inputmode="decimal"
					autocomplete="off"
					aria-label={m.budget_move_amount()}
					placeholder="0"
				/>
			</div>
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
			<Button type="submit">{m.budget_move()}</Button>
		</form>
	{:else if view === 'settings'}
		<CategorySettings {category} {groups} />
	{:else}
		<CategoryDelete
			{category}
			{groups}
			{model}
			onCancel={() => go('main')}
			onDone={() => (open = false)}
		/>
	{/if}
</ResponsiveDialog>
