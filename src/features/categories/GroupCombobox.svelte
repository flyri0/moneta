<script lang="ts">
	import * as Command from '$ui/command';
	import PickerShell from '$components/PickerShell.svelte';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
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

<PickerShell
	bind:open
	{id}
	{ariaLabel}
	{disabled}
	label={selectedLabel ?? placeholder}
	muted={!selectedLabel}
	title={ariaLabel ?? placeholder}
	class={className}
>
	{#snippet children(layout)}
		<Command.Root class={layout.root}>
			<Command.Input placeholder={m.category_group_search()} bind:value={search} />
			<Command.List class={layout.list}>
				<Command.Empty>{m.combobox_empty()}</Command.Empty>
				<GroupItems
					{groups}
					typed={search.trim()}
					selected={value}
					createFirst={layout.phone}
					onPick={choose}
				/>
			</Command.List>
		</Command.Root>
	{/snippet}
</PickerShell>
