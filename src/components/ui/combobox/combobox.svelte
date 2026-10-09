<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Command from '$ui/command';
	import PickerShell from '$components/PickerShell.svelte';
	import { cn } from '$utils';
	import { m } from '$i18n/paraglide/messages';
	import { hasExactMatch } from './match';

	export interface ComboboxItem {
		value: string;
		label: string;
		keywords?: string[];
	}

	export interface ComboboxGroup {
		heading: string;
		items: ComboboxItem[];
	}

	let {
		value = $bindable(''),
		items = [],
		groups = [],
		placeholder = '',
		searchPlaceholder = m.combobox_search(),
		emptyText = m.combobox_empty(),
		emptyOption,
		id,
		name,
		disabled = false,
		class: className,
		ariaLabel,
		onSelect,
		allowCustom = false,
		createLabel
	}: {
		value?: string;
		items?: ComboboxItem[];
		groups?: ComboboxGroup[];
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		emptyOption?: { value: string; label: string };
		id?: string;
		name?: string;
		disabled?: boolean;
		class?: string;
		ariaLabel?: string;
		onSelect?: (val: string) => void;
		allowCustom?: boolean;
		createLabel?: (query: string) => string;
	} = $props();

	let open = $state(false);
	let search = $state('');

	$effect(() => {
		if (!open) {
			search = '';
		}
	});

	const allItems = $derived.by(() => {
		const list: ComboboxItem[] = [];
		if (emptyOption) list.push(emptyOption);
		list.push(...items);
		for (const g of groups) list.push(...g.items);
		return list;
	});

	const selectedLabel = $derived.by(() => {
		const match = allItems.find((i) => i.value === value);
		if (match) return match.label;
		if (allowCustom && value) return value;
		return placeholder;
	});

	const trimmedSearch = $derived(search.trim());
	const showCreateOption = $derived(
		allowCustom && trimmedSearch.length > 0 && !hasExactMatch(allItems, trimmedSearch)
	);

	function handleSelect(newVal: string) {
		value = newVal;
		open = false;
		search = '';
		onSelect?.(newVal);
	}
</script>

{#snippet createRow()}
	<Command.Group>
		<Command.Item
			value={trimmedSearch}
			keywords={[trimmedSearch]}
			onSelect={() => handleSelect(trimmedSearch)}
			class="bg-primary/5 font-medium text-primary hover:bg-primary/10 data-selected:bg-primary/15 data-selected:text-primary"
		>
			<div
				class="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary"
			>
				<PlusIcon class="size-3.5 stroke-[2.5]" />
			</div>
			<span class="truncate">
				{createLabel ? createLabel(trimmedSearch) : m.combobox_create({ name: trimmedSearch })}
			</span>
		</Command.Item>
	</Command.Group>
{/snippet}

{#if name}
	<input type="hidden" {name} {value} />
{/if}

<PickerShell
	bind:open
	{id}
	{ariaLabel}
	{disabled}
	label={selectedLabel}
	muted={!value}
	title={ariaLabel ?? placeholder}
	class={className}
>
	{#snippet children(layout)}
		<Command.Root class={layout.root}>
			<Command.Input placeholder={searchPlaceholder} bind:value={search} />
			<Command.List class={layout.list}>
				<Command.Empty>{emptyText}</Command.Empty>
				{#if showCreateOption && layout.phone}
					{@render createRow()}
					<Command.Separator />
				{/if}
				{#if emptyOption}
					<Command.Group>
						<Command.Item
							value={emptyOption.label}
							keywords={[emptyOption.value, emptyOption.label]}
							onSelect={() => handleSelect(emptyOption.value)}
						>
							<CheckIcon
								class={cn('mr-2 size-4', value === emptyOption.value ? 'opacity-100' : 'opacity-0')}
							/>
							<span class="text-muted-foreground italic">{emptyOption.label}</span>
						</Command.Item>
					</Command.Group>
				{/if}
				{#if groups.length > 0}
					{#each groups as group (group.heading)}
						<Command.Group heading={group.heading}>
							{#each group.items as item (item.value)}
								<Command.Item
									value={item.label}
									keywords={[item.value, ...(item.keywords ?? [])]}
									onSelect={() => handleSelect(item.value)}
								>
									<CheckIcon
										class={cn('mr-2 size-4', value === item.value ? 'opacity-100' : 'opacity-0')}
									/>
									<span>{item.label}</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/each}
				{:else}
					<Command.Group>
						{#each items as item (item.value)}
							<Command.Item
								value={item.label}
								keywords={[item.value, ...(item.keywords ?? [])]}
								onSelect={() => handleSelect(item.value)}
							>
								<CheckIcon
									class={cn('mr-2 size-4', value === item.value ? 'opacity-100' : 'opacity-0')}
								/>
								<span>{item.label}</span>
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
				{#if showCreateOption && !layout.phone}
					<Command.Separator />
					{@render createRow()}
				{/if}
			</Command.List>
		</Command.Root>
	{/snippet}
</PickerShell>
