<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Collapsible from '$ui/collapsible';
	import { useSession } from '$client/app-state.svelte';
	import type { GridModel } from '$features/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import type { Month } from '$domain/month';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import AssignedInput from './AssignedInput.svelte';
	import AvailablePill from './AvailablePill.svelte';
	import CategoryCard from './CategoryCard.svelte';

	let {
		model,
		month,
		collapsed,
		onSelectCategory,
		onSelectGroup,
		onToggleGroup
	}: {
		model: GridModel;
		month: Month;
		collapsed: ReadonlySet<string>;
		onSelectCategory: (id: string) => void;
		onSelectGroup: (id: string) => void;
		onToggleGroup: (id: string) => void;
	} = $props();

	const session = useSession();
	// Cards below 1024px, the four-column table above. Only one of the two is rendered.
	// The table needs 1024px, not the usual 768px: the sidebar takes 256px of it, and below that
	// the four money columns leave nothing for the category name.
	const desktop = new MediaQuery('min-width: 1024px');
	const COLUMNS = 'grid grid-cols-[1fr_9rem_8rem_9rem] items-center gap-2';

	const toggleLabel = (group: BudgetGroupView, open: boolean) =>
		open
			? m.budget_collapse_group({ name: groupLabel(group) })
			: m.budget_expand_group({ name: groupLabel(group) });
</script>

{#snippet chevron(group: BudgetGroupView, open: boolean)}
	<button
		type="button"
		class="-ml-1 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
		aria-expanded={open}
		aria-label={toggleLabel(group, open)}
		onclick={() => onToggleGroup(group.id)}
	>
		<ChevronRightIcon class="size-4 transition-transform {open ? 'rotate-90' : ''}" />
	</button>
{/snippet}

{#snippet categoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} px-4 py-2 transition-colors hover:bg-muted/30" data-testid="category-row">
		<button
			type="button"
			class="cursor-pointer truncate text-left text-sm font-medium hover:underline"
			onclick={() => onSelectCategory(category.id)}>{category.name}</button
		>
		<div>
			<AssignedInput
				categoryId={category.id}
				{month}
				assigned={category.assigned}
				label={m.budget_assigned_for({ name: category.name })}
			/>
		</div>
		<span class="text-right text-sm text-muted-foreground tabular-nums" data-testid="activity">
			{session.format(category.activity)}
		</span>
		<span class="text-right"><AvailablePill {category} /></span>
	</div>
{/snippet}

{#snippet incomeCategoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} px-4 py-2 transition-colors hover:bg-muted/30" data-testid="category-row">
		<button
			type="button"
			class="cursor-pointer truncate text-left text-sm font-medium hover:underline"
			onclick={() => onSelectCategory(category.id)}>{category.name}</button
		>
		<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
		<span
			class="text-right text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400"
			data-testid="activity"
		>
			{session.format(category.activity)}
		</span>
		<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
	</div>
{/snippet}

{#snippet incomeCategoryCard(category: BudgetCategoryView)}
	<div
		class="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
		data-testid="category-row"
	>
		<button
			type="button"
			class="-my-1 min-w-0 flex-1 cursor-pointer truncate py-1 text-left font-medium hover:underline"
			onclick={() => onSelectCategory(category.id)}>{category.name}</button
		>
		<span class="text-sm font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
			{session.format(category.activity)}
		</span>
	</div>
{/snippet}

{#snippet categoryItem(category: BudgetCategoryView, isIncome = false)}
	{#if desktop.current}
		{#if isIncome}
			{@render incomeCategoryRow(category)}
		{:else}
			{@render categoryRow(category)}
		{/if}
	{:else}
		{#if isIncome}
			{@render incomeCategoryCard(category)}
		{:else}
			<CategoryCard {category} onSelect={onSelectCategory} />
		{/if}
	{/if}
{/snippet}

{#if desktop.current}
	<section class="grid gap-4" aria-label={m.budget_categories()}>
		<div
			class="{COLUMNS} px-4 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
		>
			<span>{m.budget_category()}</span>
			<span class="text-right">{m.budget_assigned()}</span>
			<span class="text-right">{m.budget_activity()}</span>
			<span class="text-right">{m.budget_available()}</span>
		</div>
		{#each model.groups as group (group.id)}
			{@const open = !collapsed.has(group.id)}
			{@const isIncome = group.system === 'income'}
			<div
				class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
				data-testid="group-card"
			>
				<div
					class="{COLUMNS} bg-muted/40 px-4 py-2.5 font-medium transition-colors"
					data-testid="group-row"
				>
					<div class="flex min-w-0 items-center gap-1.5">
						{@render chevron(group, open)}
						<button
							type="button"
							class="cursor-pointer truncate text-left font-semibold hover:underline"
							onclick={() => onSelectGroup(group.id)}>{groupLabel(group)}</button
						>
					</div>
					{#if isIncome}
						<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
						<span
							class="text-right text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400"
							>{session.format(group.activity)}</span
						>
						<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
					{:else}
						<span class="text-right font-medium tabular-nums">{session.format(group.assigned)}</span
						>
						<span class="text-right text-sm text-muted-foreground tabular-nums"
							>{session.format(group.activity)}</span
						>
						<span class="text-right font-semibold tabular-nums"
							>{session.format(group.available)}</span
						>
					{/if}
				</div>
				{#if open}
					{#each group.categories as category (category.id)}
						{#if isIncome}
							{@render incomeCategoryRow(category)}
						{:else}
							{@render categoryRow(category)}
						{/if}
					{/each}
				{/if}
			</div>
		{/each}
	</section>
{:else}
	<section class="grid gap-4" aria-label={m.budget_categories()}>
		{#each model.groups as group (group.id)}
			{@const open = !collapsed.has(group.id)}
			{@const isIncome = group.system === 'income'}
			<div class="grid gap-2" data-testid="group-card">
				<div
					class="flex items-center justify-between px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
					data-testid="group-row"
				>
					<div class="flex min-w-0 items-center gap-1.5">
						{@render chevron(group, open)}
						<button
							type="button"
							class="min-w-0 flex-1 cursor-pointer truncate text-left hover:text-foreground"
							onclick={() => onSelectGroup(group.id)}>{groupLabel(group)}</button
						>
					</div>
					{#if isIncome}
						<span
							class="shrink-0 text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400"
						>
							+{session.format(group.activity)}
						</span>
					{:else}
						<span class="shrink-0 text-sm font-semibold text-foreground tabular-nums">
							{session.format(group.available)}
						</span>
					{/if}
				</div>
				{#if open}
					<div
						class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
					>
						{#each group.categories as category (category.id)}
							{#if isIncome}
								{@render incomeCategoryCard(category)}
							{:else}
								<CategoryCard {category} onSelect={onSelectCategory} />
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</section>
{/if}

{#if model.hidden.length > 0}
	<Collapsible.Root class="mt-4 grid gap-2">
		<Collapsible.Trigger
			class="group inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
		>
			<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
			{m.budget_hidden_categories({ count: model.hidden.length })}
		</Collapsible.Trigger>
		<Collapsible.Content>
			<div
				class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
			>
				{#each model.hidden as { category, group } (category.id)}
					{@render categoryItem(category, group.system === 'income')}
				{/each}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
