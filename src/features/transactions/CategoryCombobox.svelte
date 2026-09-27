<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Command from '$ui/command';
	import * as Popover from '$ui/popover';
	import type { GroupNode } from '$db/repos/categories';
	import { foldText } from '$domain/search';
	import { categoryLabel, groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import { NewCategories } from './new-categories';

	/**
	 * Picks a category. Typing a name no category has offers to create it: a second step picks its
	 * group, or names a new one. Nothing is created here: the value becomes a token of `pending`,
	 * which the form turns into a category when it saves.
	 */
	let {
		tree,
		options,
		pending,
		value = $bindable(''),
		onSelect,
		id,
		ariaLabel,
		emptyLabel = m.transaction_choose_category(),
		class: className
	}: {
		tree: GroupNode[];
		/** The groups and categories to offer; the tree's visible categories when left out. */
		options?: {
			id: string;
			name: string;
			system: GroupNode['system'];
			categories: { id: string; name: string }[];
		}[];
		pending: NewCategories;
		value?: string;
		onSelect?: (value: string) => void;
		id?: string;
		ariaLabel?: string;
		/** What choosing no category is called. */
		emptyLabel?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');
	/** The category being created, while its group is picked. */
	let naming = $state<string | null>(null);

	$effect(() => {
		if (!open) {
			search = '';
			naming = null;
		}
	});

	const offered = $derived(
		(
			options ??
			tree.map((g) => ({
				...g,
				categories: g.categories.filter((c) => !c.hidden || c.id === value)
			}))
		).filter((g) => g.categories.length > 0)
	);
	const groups = $derived(tree.filter((g) => !g.hidden));

	const typed = $derived(search.trim());
	const categoryExists = $derived(
		offered.some((g) => g.categories.some((c) => foldText(categoryLabel(c)) === foldText(typed)))
	);
	const groupExists = $derived(groups.some((g) => foldText(groupLabel(g)) === foldText(typed)));

	const selectedLabel = $derived.by(() => {
		for (const g of offered) {
			const c = g.categories.find((c) => c.id === value);
			if (c) return categoryLabel(c);
		}
		if (NewCategories.isToken(value))
			return pending.label(value, (category, group) =>
				m.category_new_in_group({ category, group })
			);
		return null;
	});

	function choose(next: string) {
		value = next;
		open = false;
		onSelect?.(next);
	}

	function startCreating() {
		naming = typed;
		search = '';
	}

	function back() {
		search = naming ?? '';
		naming = null;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		{id}
		role="combobox"
		aria-expanded={open}
		aria-label={ariaLabel}
		class={cn(
			'flex h-9 w-full min-w-0 items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-2 text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
			!selectedLabel && 'text-muted-foreground',
			className
		)}
	>
		<span class="truncate">{selectedLabel ?? emptyLabel}</span>
		<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
	</Popover.Trigger>
	<Popover.Content
		class="z-[60] w-[var(--bits-popover-anchor-width)] min-w-[220px] p-0"
		align="start"
	>
		<Command.Root>
			<Command.Input
				placeholder={naming === null ? m.combobox_search() : m.category_group_search()}
				bind:value={search}
			/>
			<Command.List
				class="max-h-[min(var(--bits-popover-content-available-height,15rem),15rem)] overflow-y-auto"
			>
				<Command.Empty>{m.combobox_empty()}</Command.Empty>
				{#if naming === null}
					<Command.Group>
						<Command.Item value={emptyLabel} onSelect={() => choose('')}>
							<CheckIcon class={cn('mr-2 size-4', value === '' ? 'opacity-100' : 'opacity-0')} />
							<span class="text-muted-foreground italic">{emptyLabel}</span>
						</Command.Item>
					</Command.Group>
					{#each offered as group (group.id)}
						<Command.Group heading={groupLabel(group)}>
							{#each group.categories as category (category.id)}
								<Command.Item
									value={`${categoryLabel(category)} ${category.id}`}
									keywords={[categoryLabel(category)]}
									onSelect={() => choose(category.id)}
								>
									<CheckIcon
										class={cn('mr-2 size-4', value === category.id ? 'opacity-100' : 'opacity-0')}
									/>
									<span>{categoryLabel(category)}</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/each}
					{#if typed && !categoryExists}
						<Command.Separator />
						<Command.Group>
							<Command.Item
								value={`create ${typed}`}
								keywords={[typed]}
								onSelect={startCreating}
								class="bg-primary/5 font-medium text-primary hover:bg-primary/10 data-selected:bg-primary/15 data-selected:text-primary"
							>
								<div
									class="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary"
								>
									<PlusIcon class="size-3.5 stroke-[2.5]" />
								</div>
								<span class="truncate">{m.category_create({ name: typed })}</span>
							</Command.Item>
						</Command.Group>
					{/if}
				{:else}
					<Command.Group forceMount>
						<Command.Item value="back" forceMount onSelect={back}>
							<ArrowLeftIcon class="mr-2 size-4" />
							<span>{m.back()}</span>
						</Command.Item>
					</Command.Group>
					<Command.Group heading={m.category_add_to({ name: naming })}>
						{#each groups as group (group.id)}
							<Command.Item
								value={`${groupLabel(group)} ${group.id}`}
								keywords={[groupLabel(group)]}
								onSelect={() => naming !== null && choose(pending.add(naming, { id: group.id }))}
							>
								<span class="ml-6">{groupLabel(group)}</span>
							</Command.Item>
						{/each}
					</Command.Group>
					{#if typed && !groupExists}
						<Command.Separator />
						<Command.Group>
							<Command.Item
								value={`new group ${typed}`}
								keywords={[typed]}
								onSelect={() => naming !== null && choose(pending.add(naming, { name: typed }))}
								class="bg-primary/5 font-medium text-primary hover:bg-primary/10 data-selected:bg-primary/15 data-selected:text-primary"
							>
								<div
									class="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary"
								>
									<PlusIcon class="size-3.5 stroke-[2.5]" />
								</div>
								<span class="truncate">{m.category_new_group({ name: typed })}</span>
							</Command.Item>
						</Command.Group>
					{/if}
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
