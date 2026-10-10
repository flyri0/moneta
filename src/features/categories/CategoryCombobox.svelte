<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Command from '$ui/command';
	import PickerShell from '$components/PickerShell.svelte';
	import { foldText } from '$domain/search';
	import { categoryLabel, groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import GroupItems from './GroupItems.svelte';
	import AvailablePill from '$features/budget/AvailablePill.svelte';
	import type { CategoryAvailable } from './available';
	import { NewCategories, type NewCategoryGroup } from './new-categories';
	import type { PickerGroup, PickerTreeGroup } from './picker';

	/**
	 * Picks a category. Typing a name no category has offers to create it: a second step picks its
	 * group, or names a new one. Nothing is created here: the value becomes a token of `pending`,
	 * which the form turns into a category when it saves.
	 */
	let {
		tree,
		options,
		newIn,
		pending,
		value = $bindable(''),
		onSelect,
		id,
		ariaLabel,
		emptyLabel = m.transaction_choose_category(),
		allowEmpty = true,
		creatable = true,
		available,
		class: className
	}: {
		tree: PickerTreeGroup[];
		/** The groups and categories to offer; the tree's visible categories when left out. */
		options?: PickerTreeGroup[];
		/** The groups a new category can go in; the tree's visible groups when left out. */
		newIn?: PickerGroup[];
		pending: NewCategories;
		value?: string;
		onSelect?: (value: string) => void;
		id?: string;
		ariaLabel?: string;
		/** What choosing no category is called, and what the field shows while empty. */
		emptyLabel?: string;
		/** Whether choosing no category is offered. */
		allowEmpty?: boolean;
		/** Whether a typed name can become a new category. */
		creatable?: boolean;
		/** Each category's Available, shown on its row; rows without an entry show none. */
		available?: ReadonlyMap<string, CategoryAvailable>;
		class?: string;
	} = $props();

	let shell = $state<ReturnType<typeof PickerShell>>();
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
	const groups = $derived(newIn ?? tree.filter((g) => !g.hidden));

	const typed = $derived(search.trim());
	const categoryExists = $derived(
		offered.some((g) => g.categories.some((c) => foldText(categoryLabel(c)) === foldText(typed)))
	);
	const creating = $derived(creatable && typed !== '' && !categoryExists);

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

	function createIn(group: NewCategoryGroup) {
		if (naming !== null) choose(pending.add(naming, group));
	}

	function startCreating() {
		naming = typed;
		search = '';
		shell?.dismissKeyboard();
	}

	function back() {
		search = naming ?? '';
		naming = null;
	}
</script>

{#snippet createRow()}
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
{/snippet}

<PickerShell
	bind:this={shell}
	bind:open
	{id}
	{ariaLabel}
	label={selectedLabel ?? emptyLabel}
	muted={!selectedLabel}
	title={ariaLabel ?? emptyLabel}
	onBack={naming === null ? undefined : back}
	class={className}
>
	{#snippet children(layout)}
		<Command.Root class={layout.root}>
			<Command.Input
				placeholder={naming === null ? m.combobox_search() : m.category_group_search()}
				bind:value={search}
			/>
			<Command.List class={layout.list}>
				<Command.Empty>{m.combobox_empty()}</Command.Empty>
				{#if naming === null}
					{#if creating && layout.phone}
						{@render createRow()}
						<Command.Separator />
					{/if}
					{#if allowEmpty}
						<Command.Group>
							<Command.Item value={emptyLabel} onSelect={() => choose('')}>
								<CheckIcon class={cn('mr-2 size-4', value === '' ? 'opacity-100' : 'opacity-0')} />
								<span class="text-muted-foreground italic">{emptyLabel}</span>
							</Command.Item>
						</Command.Group>
					{/if}
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
									<span class="min-w-0 flex-1 truncate">{categoryLabel(category)}</span>
									{#if available?.has(category.id)}
										<span class="shrink-0">
											<AvailablePill category={available.get(category.id)!} />
										</span>
									{/if}
								</Command.Item>
							{/each}
						</Command.Group>
					{/each}
					{#if creating && !layout.phone}
						<Command.Separator />
						{@render createRow()}
					{/if}
				{:else}
					{#if !layout.phone}
						<Command.Group forceMount>
							<Command.Item value="back" forceMount onSelect={back}>
								<ArrowLeftIcon class="mr-2 size-4" />
								<span>{m.back()}</span>
							</Command.Item>
						</Command.Group>
					{/if}
					<GroupItems
						{groups}
						{typed}
						createFirst={layout.phone}
						heading={m.category_add_to({ name: naming })}
						onPick={createIn}
					/>
				{/if}
			</Command.List>
		</Command.Root>
	{/snippet}
</PickerShell>
