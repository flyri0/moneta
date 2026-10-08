<script lang="ts">
	import PickerShell from '$components/PickerShell.svelte';
	import type { FlagColor } from '$domain/flag';
	import { m } from '$i18n/paraglide/messages';
	import FlagIcon from './FlagIcon.svelte';
	import FlagList from './FlagList.svelte';
	import FlagNames from './FlagNames.svelte';
	import { flagLabel } from './flags';
	import { useFlags } from './use-flags.svelte';

	/**
	 * A field for a transaction's flag. Its picker also renames the flags, on a screen of its own
	 * with a way back. `onchange` gets the flag, or null for none.
	 */
	let {
		value,
		onchange,
		id,
		ariaLabel = m.flag_label(),
		class: className
	}: {
		value: FlagColor | null;
		onchange: (flag: FlagColor | null) => void;
		id?: string;
		ariaLabel?: string;
		class?: string;
	} = $props();

	const flags = useFlags();
	let open = $state(false);
	let renaming = $state(false);

	$effect(() => {
		if (!open) renaming = false;
	});
</script>

<PickerShell
	bind:open
	{id}
	{ariaLabel}
	label={value ? flagLabel(value, flags.data) : m.flag_none()}
	muted={!value}
	title={renaming ? m.flag_names_title() : ariaLabel}
	onBack={renaming ? () => (renaming = false) : undefined}
	class={className}
	contentClass={renaming ? 'w-80' : undefined}
>
	{#snippet leading()}
		<FlagIcon color={value} />
	{/snippet}
	{#snippet children(layout)}
		{#if renaming}
			<div
				class={layout.phone
					? 'min-h-0 flex-1 overflow-y-auto p-4'
					: 'max-h-[var(--bits-popover-content-available-height,24rem)] overflow-y-auto p-3'}
			>
				<FlagNames flags={flags.data} ondone={() => (renaming = false)} />
			</div>
		{:else}
			<FlagList
				{value}
				flags={flags.data}
				root={layout.root}
				list={layout.list}
				onselect={(flag) => {
					open = false;
					onchange(flag);
				}}
				onEditNames={() => (renaming = true)}
			/>
		{/if}
	{/snippet}
</PickerShell>
