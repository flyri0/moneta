<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Collapsible from '$ui/collapsible';
	import { useSession } from '$client/app-state.svelte';
	import { availableTone, overspentCount, type GridModel } from '$features/budget/view';
	import type { BudgetCategoryView, BudgetGroupView } from '$db/repos/budget';
	import type { Month } from '$domain/month';
	import Amount from '$components/Amount.svelte';
	import IconLabel from '$components/IconLabel.svelte';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import AssignedInput from './AssignedInput.svelte';
	import AvailablePill from './AvailablePill.svelte';
	import CategoryCard from './CategoryCard.svelte';
	import CategoryProgressBar from './CategoryProgressBar.svelte';
	import { TONE_PILL, TONE_ROW } from './tones';

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
		class="relative -ml-1 cursor-pointer rounded p-0.5 text-muted-foreground after:absolute after:-inset-y-2 after:-right-1 after:-left-2 hover:text-foreground"
		aria-expanded={open}
		aria-label={toggleLabel(group, open)}
		onclick={() => onToggleGroup(group.id)}
	>
		<ChevronRightIcon class="size-4 transition-transform {open ? 'rotate-90' : ''}" />
	</button>
{/snippet}

<!-- Stays on a collapsed group's header, so folding a group never hides its overspending. -->
{#snippet overspentBadge(group: BudgetGroupView)}
	{@const count = overspentCount(group)}
	{#if count > 0}
		<span
			class="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tracking-normal tabular-nums {TONE_PILL.overspent}"
			role="img"
			aria-label={m.budget_group_overspent({ count })}
			data-testid="group-overspent"
		>
			<TriangleAlertIcon class="size-3 shrink-0" aria-hidden="true" />
			{count}
		</span>
	{/if}
{/snippet}

{#snippet categoryRow(category: BudgetCategoryView)}
	{@const tone = availableTone(category)}
	<div
		class="{COLUMNS} px-4 py-2 transition-colors hover:bg-muted/30 {TONE_ROW[tone]}"
		data-testid="category-row"
		data-tone={tone}
		data-tour="category"
	>
		<div class="grid min-w-0 gap-1.5">
			<button
				type="button"
				data-testid="category-name"
				class="cursor-pointer truncate text-left text-sm font-medium hover:underline"
				onclick={() => onSelectCategory(category.id)}
				><IconLabel icon={category.icon} label={category.name} /></button
			>
			<CategoryProgressBar {category} />
		</div>
		<div>
			<AssignedInput
				categoryId={category.id}
				{month}
				assigned={category.assigned}
				label={m.budget_assigned_for({ name: category.name })}
			/>
		</div>
		<Amount
			amount={category.activity}
			flow
			class="text-right text-sm text-muted-foreground"
			data-testid="activity"
		/>
		<span class="text-right"><AvailablePill {category} /></span>
	</div>
{/snippet}

{#snippet incomeCategoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} px-4 py-2 transition-colors hover:bg-muted/30" data-testid="category-row">
		<button
			type="button"
			class="cursor-pointer truncate text-left text-sm font-medium hover:underline"
			onclick={() => onSelectCategory(category.id)}
			><IconLabel icon={category.icon} label={category.name} /></button
		>
		<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
		<Amount
			amount={category.activity}
			flow
			class="text-right text-sm font-semibold"
			data-testid="activity"
		/>
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
			onclick={() => onSelectCategory(category.id)}
			><IconLabel icon={category.icon} label={category.name} /></button
		>
		<Amount amount={category.activity} flow class="text-sm font-medium" />
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
							onclick={() => onSelectGroup(group.id)}
							><IconLabel icon={group.icon} label={groupLabel(group)} /></button
						>
						{@render overspentBadge(group)}
					</div>
					{#if isIncome}
						<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
						<Amount amount={group.activity} flow class="text-right text-sm font-semibold" />
						<span class="text-right text-sm text-muted-foreground tabular-nums">—</span>
					{:else}
						<span class="text-right font-medium tabular-nums">{session.format(group.assigned)}</span
						>
						<Amount amount={group.activity} flow class="text-right text-sm text-muted-foreground" />
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
							class="-my-2 min-w-0 flex-1 cursor-pointer truncate py-2 text-left hover:text-foreground"
							onclick={() => onSelectGroup(group.id)}
							><IconLabel icon={group.icon} label={groupLabel(group)} /></button
						>
						{@render overspentBadge(group)}
					</div>
					{#if isIncome}
						<Amount
							amount={group.activity}
							flow
							class="shrink-0 text-sm font-semibold"
							data-testid="income-total"
						/>
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

{#if model.hiddenCount > 0}
	{@const loose = model.hidden.filter((h) => !h.group.hidden)}
	<Collapsible.Root class="mt-4 grid gap-2">
		<Collapsible.Trigger
			class="group inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
		>
			<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
			{m.budget_hidden({ count: model.hiddenCount })}
		</Collapsible.Trigger>
		<Collapsible.Content class="grid gap-4">
			{#if loose.length > 0}
				<div
					class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
				>
					{#each loose as { category, group } (category.id)}
						{@render categoryItem(category, group.system === 'income')}
					{/each}
				</div>
			{/if}
			<!-- A hidden group's name opens its sheet, where it can be shown again. -->
			{#each model.hiddenGroups as group (group.id)}
				<div class="grid gap-2" data-testid="hidden-group">
					<button
						type="button"
						class="cursor-pointer truncate px-1 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
						onclick={() => onSelectGroup(group.id)}
						><IconLabel icon={group.icon} label={groupLabel(group)} /></button
					>
					{#if group.categories.length > 0}
						<div
							class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
						>
							{#each group.categories as category (category.id)}
								{@render categoryItem(category, group.system === 'income')}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
