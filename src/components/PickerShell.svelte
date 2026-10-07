<script lang="ts" module>
	/** How a picker lays out its `Command.Root` and `Command.List` in the shell. */
	export interface PickerLayout {
		/** Whether the picker fills the screen, as on phones. */
		phone: boolean;
		/** Classes for the `Command.Root`. */
		root: string;
		/** Classes for the `Command.List`. */
		list: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { Dialog, Popover } from 'bits-ui';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { Button } from '$ui/button';
	import * as PopoverUi from '$ui/popover';
	import { VisibleArea } from '$client/visible-area.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * The field and the panel of a picker: a popover under the field on desktop, and on phones
	 * (below 768px) a screen of its own that fits above the keyboard, with a back button and
	 * `title`. `onBack` replaces closing, for a picker's own second step.
	 */
	let {
		open = $bindable(false),
		label,
		muted = false,
		title,
		onBack,
		id,
		ariaLabel,
		disabled = false,
		class: className,
		contentClass,
		children
	}: {
		open?: boolean;
		/** What the field shows. */
		label: string;
		/** Whether `label` is a placeholder. */
		muted?: boolean;
		title: string;
		onBack?: () => void;
		id?: string;
		ariaLabel?: string;
		disabled?: boolean;
		class?: string;
		/** Classes for the popover on desktop, to size it otherwise than to the field. */
		contentClass?: string;
		children: Snippet<[PickerLayout]>;
	} = $props();

	const desktop = new MediaQuery('min-width: 768px');
	const area = new VisibleArea();
	let screen = $state<HTMLElement | null>(null);

	/** Moves focus off the search on phones, which puts the keyboard away. */
	export function dismissKeyboard() {
		if (!desktop.current) screen?.focus({ preventScroll: true });
	}

	/** Focuses the screen itself: the keyboard comes up only when the search is tapped. */
	function openAutoFocus(event: Event) {
		event.preventDefault();
		screen?.focus({ preventScroll: true });
	}

	const triggerClass = $derived(
		cn(
			'flex h-9 w-full min-w-0 items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-2 text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
			muted && 'text-muted-foreground',
			className
		)
	);
</script>

{#snippet field()}
	<span class="truncate">{label}</span>
	<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
{/snippet}

{#if desktop.current}
	<Popover.Root bind:open>
		<Popover.Trigger
			{id}
			role="combobox"
			aria-expanded={open}
			aria-label={ariaLabel}
			{disabled}
			class={triggerClass}
		>
			{@render field()}
		</Popover.Trigger>
		<PopoverUi.Content
			data-picker
			class={cn('z-[60] w-[var(--bits-popover-anchor-width)] min-w-[220px] p-0', contentClass)}
			align="start"
		>
			{@render children({
				phone: false,
				root: 'outline-none',
				list: 'max-h-[min(var(--bits-popover-content-available-height,15rem),15rem)] overflow-y-auto'
			})}
		</PopoverUi.Content>
	</Popover.Root>
{:else}
	<Dialog.Root bind:open>
		<Dialog.Trigger
			type="button"
			{id}
			role="combobox"
			aria-expanded={open}
			aria-label={ariaLabel}
			{disabled}
			class={triggerClass}
		>
			{@render field()}
		</Dialog.Trigger>
		<Dialog.Portal>
			<Dialog.Content
				bind:ref={screen}
				data-picker
				aria-describedby={undefined}
				onOpenAutoFocus={openAutoFocus}
				style="top: {area.current.top}px; height: {area.current.height}px"
				class="fixed inset-x-0 z-[60] flex flex-col bg-popover text-popover-foreground outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0"
			>
				<div
					class="flex shrink-0 items-center gap-1 border-b px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
				>
					<Button variant="ghost" size="icon" onclick={() => (onBack ? onBack() : (open = false))}>
						<ArrowLeftIcon />
						<span class="sr-only">{m.back()}</span>
					</Button>
					<Dialog.Title class="min-w-0 truncate text-base font-medium">{title}</Dialog.Title>
				</div>
				{@render children({
					phone: true,
					root: 'min-h-0 flex-1 rounded-none! bg-transparent outline-none',
					list: 'min-h-0 max-h-none flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] **:data-[slot=command-item]:min-h-11'
				})}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
