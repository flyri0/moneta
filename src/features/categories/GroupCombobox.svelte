<script lang="ts">
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import * as Command from '$ui/command';
	import * as Popover from '$ui/popover';
	import { PickerKeyboard } from '$components/picker.svelte';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import GroupItems from './GroupItems.svelte';
	import { NewCategories, type NewCategoryGroup } from './new-categories';
	import type { PickerGroup } from './picker';

	/**
	 * Picks a group. Typing a name no group has offers to create it: nothing is created here, the
	 * value becomes a token of `pending`, which the form turns into a group when it saves.
	 */
	let {
		groups,
		pending,
		value = $bindable(''),
		onSelect,
		id,
		ariaLabel,
		placeholder = '',
		disabled = false,
		class: className
	}: {
		groups: PickerGroup[];
		pending: NewCategories;
		value?: string;
		onSelect?: (value: string) => void;
		id?: string;
		ariaLabel?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const keyboard = new PickerKeyboard();
	let open = $state(false);
	let search = $state('');

	$effect(() => {
		if (!open) search = '';
	});

	const selectedLabel = $derived.by(() => {
		const group = groups.find((g) => g.id === value);
		if (group) return groupLabel(group);
		if (NewCategories.isGroupToken(value)) return pending.label(value, (c) => c);
		return null;
	});

	function choose(group: NewCategoryGroup) {
		const next = 'id' in group ? group.id : pending.addGroup(group.name);
		value = next;
		open = false;
		onSelect?.(next);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		{id}
		role="combobox"
		aria-expanded={open}
		aria-label={ariaLabel}
		{disabled}
		class={cn(
			'flex h-9 w-full min-w-0 items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-2 text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
			!selectedLabel && 'text-muted-foreground',
			className
		)}
	>
		<span class="truncate">{selectedLabel ?? placeholder}</span>
		<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
	</Popover.Trigger>
	<Popover.Content
		class="z-[60] w-[var(--bits-popover-anchor-width)] min-w-[220px] p-0"
		align="start"
		onOpenAutoFocus={keyboard.openAutoFocus}
	>
		<Command.Root bind:ref={keyboard.root} class="outline-none">
			<Command.Input placeholder={m.category_group_search()} bind:value={search} />
			<Command.List
				class="max-h-[min(var(--bits-popover-content-available-height,15rem),15rem)] overflow-y-auto max-md:**:data-[slot=command-item]:min-h-11"
			>
				<Command.Empty>{m.combobox_empty()}</Command.Empty>
				<GroupItems
					{groups}
					typed={search.trim()}
					selected={value}
					createFirst={keyboard.createFirst}
					onPick={choose}
				/>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
