<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Command from '$ui/command';
	import * as Popover from '$ui/popover';
	import { cn } from '$utils';
	import { m } from '$i18n/paraglide/messages';

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
		contentClass,
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
		contentClass?: string;
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
	const hasExactMatch = $derived(
		allItems.some(
			(i) =>
				i.label.toLowerCase() === trimmedSearch.toLowerCase() ||
				i.value.toLowerCase() === trimmedSearch.toLowerCase()
		)
	);
	const showCreateOption = $derived(allowCustom && trimmedSearch.length > 0 && !hasExactMatch);

	function handleSelect(newVal: string) {
		value = newVal;
		open = false;
		search = '';
		onSelect?.(newVal);
	}
</script>

{#if name}
	<input type="hidden" {name} {value} />
{/if}

<Popover.Root bind:open>
	<Popover.Trigger
		{id}
		role="combobox"
		aria-expanded={open}
		aria-label={ariaLabel}
		{disabled}
		class={cn(
			'flex h-9 w-full min-w-0 items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-2 text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
			!value && 'text-muted-foreground',
			className
		)}
	>
		<span class="truncate">
			{selectedLabel}
		</span>
		<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
	</Popover.Trigger>
	<Popover.Content
		class={cn('z-[60] w-[var(--bits-popover-anchor-width)] min-w-[220px] p-0', contentClass)}
		align="start"
	>
		<Command.Root>
			<Command.Input placeholder={searchPlaceholder} bind:value={search} />
			<Command.List
				class="max-h-[min(var(--bits-popover-content-available-height,15rem),15rem)] overflow-y-auto"
			>
				<Command.Empty>{emptyText}</Command.Empty>
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
				{#if showCreateOption}
					<Command.Group>
						<Command.Item
							value={trimmedSearch}
							keywords={[trimmedSearch]}
							onSelect={() => handleSelect(trimmedSearch)}
						>
							<PlusIcon class="mr-2 size-4 text-muted-foreground" />
							<span>
								{createLabel
									? createLabel(trimmedSearch)
									: m.combobox_create({ name: trimmedSearch })}
							</span>
						</Command.Item>
					</Command.Group>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
