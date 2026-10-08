<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$ui/button';
	import PickerShell from '$components/PickerShell.svelte';
	import { m } from '$i18n/paraglide/messages';
	import EmojiPicker from './EmojiPicker.svelte';

	/**
	 * A field for an emoji icon: it opens the `EmojiPicker` (a popover on desktop, a screen of its
	 * own on phones), and a button beside it takes the icon away. `onchange` gets the emoji, or
	 * null when it is removed.
	 */
	let {
		value,
		onchange,
		id,
		ariaLabel = m.icon_label(),
		disabled = false
	}: {
		value: string | null;
		onchange: (icon: string | null) => void;
		id?: string;
		ariaLabel?: string;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
</script>

<div class="flex items-center gap-2">
	<!-- It fades and slides, without the popover's zoom: Chrome redraws every emoji at each scale of
	the zoom, in each frame of the animation. -->
	<PickerShell
		bind:open
		{id}
		{ariaLabel}
		{disabled}
		label={value ?? m.icon_none()}
		muted={!value}
		title={ariaLabel}
		class={value ? 'text-lg' : undefined}
		contentClass="w-80 [--tw-enter-scale:1]! [--tw-exit-scale:1]!"
	>
		{#snippet children(layout)}
			<EmojiPicker
				{value}
				class={layout.phone
					? 'flex-1 pb-[env(safe-area-inset-bottom)]'
					: 'h-[min(24rem,var(--bits-popover-content-available-height,24rem))]'}
				onselect={(emoji) => {
					open = false;
					onchange(emoji);
				}}
			/>
		{/snippet}
	</PickerShell>
	{#if value}
		<Button
			variant="ghost"
			size="icon"
			class="shrink-0"
			aria-label={m.icon_remove()}
			title={m.icon_remove()}
			{disabled}
			onclick={() => onchange(null)}
		>
			<XIcon />
		</Button>
	{/if}
</div>
