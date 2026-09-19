<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { useSession } from '$lib/client/app-state.svelte';
	import type { GridModel } from '$lib/budget/view';
	import type { BudgetCategoryView } from '$lib/db/repos/budget';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import AvailablePill from './AvailablePill.svelte';

	let { model }: { model: GridModel } = $props();

	const session = useSession();
	const COLUMNS =
		'grid grid-cols-[1fr_auto_auto] items-center gap-2 md:grid-cols-[1fr_9rem_8rem_9rem]';
</script>

{#snippet categoryRow(category: BudgetCategoryView)}
	<div class="{COLUMNS} border-b px-3 py-1.5" data-testid="category-row">
		<span class="truncate">{category.name}</span>
		<span class="hidden text-right tabular-nums md:block" data-testid="assigned">
			{session.format(category.assigned)}
		</span>
		<span class="text-right text-sm text-muted-foreground tabular-nums" data-testid="activity">
			{session.format(category.activity)}
		</span>
		<span class="text-right"><AvailablePill {category} /></span>
	</div>
{/snippet}

<section aria-label={m.budget_categories()}>
	<div
		class="{COLUMNS} sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground uppercase"
	>
		<span>{m.budget_category()}</span>
		<span class="hidden text-right md:block">{m.budget_assigned()}</span>
		<span class="text-right">{m.budget_activity()}</span>
		<span class="text-right">{m.budget_available()}</span>
	</div>
	{#each model.groups as group (group.id)}
		<div class="{COLUMNS} border-b bg-muted/60 px-3 py-2 font-medium" data-testid="group-row">
			<span class="truncate">{groupLabel(group)}</span>
			<span class="hidden text-right tabular-nums md:block">{session.format(group.assigned)}</span>
			<span class="text-right text-sm tabular-nums">{session.format(group.activity)}</span>
			<span class="text-right tabular-nums">{session.format(group.available)}</span>
		</div>
		{#each group.categories as category (category.id)}
			{@render categoryRow(category)}
		{/each}
	{/each}
</section>

{#if model.hidden.length > 0}
	<Collapsible.Root class="mt-4">
		<Collapsible.Trigger
			class="group flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ChevronRightIcon class="size-4 transition-transform group-data-[state=open]:rotate-90" />
			{m.budget_hidden_categories({ count: model.hidden.length })}
		</Collapsible.Trigger>
		<Collapsible.Content>
			{#each model.hidden as { category } (category.id)}
				{@render categoryRow(category)}
			{/each}
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
