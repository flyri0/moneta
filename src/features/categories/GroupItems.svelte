<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Command from '$ui/command';
	import { foldText } from '$domain/search';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import type { NewCategoryGroup } from './new-categories';
	import type { PickerGroup } from './picker';

	/**
	 * A combobox's list of groups, and a row naming a new group after what was typed when no group
	 * has that name. Goes inside a `Command.List`.
	 */
	let {
		groups,
		typed,
		selected,
		heading,
		onPick
	}: {
		groups: PickerGroup[];
		/** The search, trimmed. */
		typed: string;
		/** The group to check. */
		selected?: string;
		heading?: string;
		onPick: (group: NewCategoryGroup) => void;
	} = $props();

	const exists = $derived(groups.some((g) => foldText(groupLabel(g)) === foldText(typed)));
</script>

<Command.Group {heading}>
	{#each groups as group (group.id)}
		<Command.Item
			value={`${groupLabel(group)} ${group.id}`}
			keywords={[groupLabel(group)]}
			onSelect={() => onPick({ id: group.id })}
		>
			<CheckIcon class={cn('mr-2 size-4', selected === group.id ? 'opacity-100' : 'opacity-0')} />
			<span>{groupLabel(group)}</span>
		</Command.Item>
	{/each}
</Command.Group>
{#if typed && !exists}
	<Command.Separator />
	<Command.Group>
		<Command.Item
			value={`new group ${typed}`}
			keywords={[typed]}
			onSelect={() => onPick({ name: typed })}
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
