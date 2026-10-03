<script lang="ts">
	import { untrack } from 'svelte';
	import HelpLink from '$components/HelpLink.svelte';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Switch } from '$ui/switch';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { BudgetCategoryView } from '$db/repos/budget';
	import type { GoalType } from '$domain/goal';
	import { formatAmountInput } from '$domain/money';
	import { addMonths, type Month } from '$domain/month';
	import { formatMonthLong } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import MonthYearPicker from './MonthYearPicker.svelte';

	/** Sets, changes or removes a category's goal. */
	let {
		category,
		month,
		onDone
	}: { category: BudgetCategoryView; month: Month; onDone: () => void } = $props();

	const session = useSession();

	let type = $state<GoalType>('monthly');
	let amountText = $state('');
	let dated = $state(false);
	let byMonth = $state<Month>('');
	let error = $state<ActionError | null>(null);

	// Filled once per category: a live refresh must not wipe what is being typed.
	const categoryId = $derived(category.id);
	$effect(() => {
		void categoryId;
		untrack(() => {
			const goal = category.goal;
			type = goal?.type ?? 'monthly';
			amountText = goal ? formatAmountInput(goal.amount, session.money) : '';
			dated = goal?.month != null;
			byMonth = goal?.month ?? addMonths(month, 11);
			error = null;
		});
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const amount = session.parse(amountText);
		if (amount === null || amount <= 0) {
			error = { message: m.form_error_amount_invalid() };
			return;
		}
		const goal = { type, amount, month: type === 'target' && dated ? byMonth : null };
		error = await runAction(() => session.api.categories.update(category.id, { goal }));
		if (!error) onDone();
	}

	async function remove() {
		error = await runAction(() => session.api.categories.update(category.id, { goal: null }));
		if (!error) onDone();
	}
</script>

<form class="grid gap-4" onsubmit={save}>
	<div class="grid gap-2">
		<div class="grid grid-cols-2 gap-2">
			<Button
				variant={type === 'monthly' ? 'secondary' : 'ghost'}
				aria-pressed={type === 'monthly'}
				onclick={() => (type = 'monthly')}>{m.category_goal_monthly()}</Button
			>
			<Button
				variant={type === 'target' ? 'secondary' : 'ghost'}
				aria-pressed={type === 'target'}
				onclick={() => (type = 'target')}>{m.category_goal_target()}</Button
			>
		</div>
		<p class="text-xs text-muted-foreground">
			{type === 'monthly' ? m.category_goal_monthly_hint() : m.category_goal_target_hint()}
		</p>
		<HelpLink topic="goals" text />
	</div>

	<div class="grid gap-2">
		<Label for="goal-amount">{m.category_goal_amount()}</Label>
		<Input
			id="goal-amount"
			bind:value={amountText}
			inputmode="decimal"
			autocomplete="off"
			placeholder="0"
		/>
	</div>

	{#if type === 'target'}
		<div class="grid gap-3">
			<div class="flex items-center justify-between gap-4">
				<Label for="goal-dated">{m.category_goal_by()}</Label>
				<Switch id="goal-dated" bind:checked={dated} />
			</div>
			{#if dated}
				<p class="text-sm font-medium" data-testid="goal-month">
					{formatMonthLong(byMonth, getLocale())}
				</p>
				<MonthYearPicker month={byMonth} navigate={false} onselect={(value) => (byMonth = value)} />
			{/if}
		</div>
	{/if}

	<FormMessage {error} />
	<div class="grid gap-2">
		<Button type="submit">{m.save()}</Button>
		{#if category.goal}
			<Button variant="ghost" class="text-destructive" onclick={remove}>
				{m.category_goal_remove()}
			</Button>
		{/if}
	</div>
</form>
