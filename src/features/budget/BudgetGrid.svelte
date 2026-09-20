<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Collapsible from '$ui/collapsible';
	import { slide } from '$client/motion.svelte';
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
		class="-ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
		aria-expanded={open}
		aria-label={toggleLabel(group, open)}
		onclick={() => onToggleGroup(group.id)}
	>
		<ChevronRightIcon class="size-4 transition-transform {open ? 'rotate-90' : ''}" />
	</button>
{/snippet}

{#snippet categoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} border-b px-3 py-1.5" data-testid="category-row">
		<button
			type="button"
			class="truncate text-left hover:underline"
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

{#snippet categoryItem(category: BudgetCategoryView)}
	{#if desktop.current}
		{@render categoryRow(category)}
	{:else}
		<CategoryCard {category} onSelect={onSelectCategory} />
	{/if}
{/snippet}

{#if desktop.current}
	<section aria-label={m.budget_categories()}>
		<div
			class="{COLUMNS} sticky top-[var(--app-top,0px)] z-10 border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground uppercase"
		>
			<span>{m.budget_category()}</span>
			<span class="text-right">{m.budget_assigned()}</span>
			<span class="text-right">{m.budget_activity()}</span>
			<span class="text-right">{m.budget_available()}</span>
		</div>
		{#each model.groups as group (group.id)}
			{@const open = !collapsed.has(group.id)}
			<div class="{COLUMNS} border-b bg-muted/60 px-3 py-2 font-medium" data-testid="group-row">
				<div class="flex min-w-0 items-center gap-1">
					{@render chevron(group, open)}
					<button
						type="button"
						class="truncate text-left hover:underline"
						onclick={() => onSelectGroup(group.id)}>{groupLabel(group)}</button
					>
				</div>
				<span class="text-right tabular-nums">{session.format(group.assigned)}</span>
				<span class="text-right text-sm tabular-nums">{session.format(group.activity)}</span>
				<span class="text-right tabular-nums">{session.format(group.available)}</span>
			</div>
			{#if open}
				<div transition:slide>
					{#each group.categories as category (category.id)}
						{@render categoryRow(category)}
					{/each}
				</div>
			{/if}
		{/each}
	</section>
{:else}
	<section class="grid gap-4" aria-label={m.budget_categories()}>
		{#each model.groups as group (group.id)}
			{@const open = !collapsed.has(group.id)}
			<div class="grid gap-2">
				<div
					class="sticky top-[var(--app-top,0px)] z-10 -mx-3 flex items-center gap-1 bg-background px-3 py-1.5"
					data-testid="group-row"
				>
					{@render chevron(group, open)}
					<button
						type="button"
						class="min-w-0 flex-1 truncate text-left text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
						onclick={() => onSelectGroup(group.id)}>{groupLabel(group)}</button
					>
					<span class="shrink-0 text-sm font-medium tabular-nums">
						{session.format(group.available)}
					</span>
				</div>
				{#if open}
					<div class="grid gap-2" transition:slide>
						{#each group.categories as category (category.id)}
							<CategoryCard {category} onSelect={onSelectCategory} />
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</section>
{/if}

{#if model.hidden.length > 0}
	<Collapsible.Root class="mt-4">
		<Collapsible.Trigger
			class="group flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
			{m.budget_hidden_categories({ count: model.hidden.length })}
		</Collapsible.Trigger>
		<Collapsible.Content class="grid gap-2">
			{#each model.hidden as { category } (category.id)}
				{@render categoryItem(category)}
			{/each}
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
