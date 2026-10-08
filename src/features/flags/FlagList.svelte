<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as Command from '$ui/command';
	import { FLAG_COLORS, type FlagColor } from '$domain/flag';
	import type { FlagRow } from '$db/repos/flags';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';
	import FlagIcon from './FlagIcon.svelte';
	import { flagLabel } from './flags';

	/**
	 * The flags to pick from, "No flag" first, and below them the way to rename them. `value` is
	 * checked; left out, nothing is. `root` and `list` lay it out in a picker's shell.
	 */
	let {
		value,
		flags,
		onselect,
		onEditNames,
		root,
		list
	}: {
		value?: FlagColor | null;
		flags: readonly FlagRow[] | undefined;
		onselect: (flag: FlagColor | null) => void;
		onEditNames?: () => void;
		root?: string;
		list?: string;
	} = $props();
</script>

<Command.Root class={root}>
	<Command.List class={list}>
		<Command.Group>
			<Command.Item value="none" onSelect={() => onselect(null)}>
				<CheckIcon class={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')} />
				<FlagIcon color={null} />
				<span class="text-muted-foreground italic">{m.flag_none()}</span>
			</Command.Item>
			{#each FLAG_COLORS as color (color)}
				<Command.Item value={color} onSelect={() => onselect(color)} data-testid="flag-option">
					<CheckIcon class={cn('size-4', value === color ? 'opacity-100' : 'opacity-0')} />
					<FlagIcon {color} />
					<span class="truncate">{flagLabel(color, flags)}</span>
				</Command.Item>
			{/each}
		</Command.Group>
		{#if onEditNames}
			<Command.Separator />
			<Command.Group>
				<Command.Item value="edit-names" onSelect={onEditNames}>
					<PencilIcon class="size-4" />
					<span>{m.flag_edit_names()}</span>
				</Command.Item>
			</Command.Group>
		{/if}
	</Command.List>
</Command.Root>
