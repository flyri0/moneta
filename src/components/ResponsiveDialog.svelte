<script lang="ts">
	import { keepOpenForToasts } from '$client/notify';
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$ui/button';
	import * as Dialog from '$ui/dialog';
	import * as Sheet from '$ui/sheet';
	import { m } from '$i18n/paraglide/messages';
	import BottomDrawer from './BottomDrawer.svelte';

	/**
	 * A dialog on desktop and a drawer on phones (below 768px). `onBack` adds a back button
	 * before the title, for screens nested inside one dialog. On desktop it focuses its first field
	 * when it opens, unless `focusFirst={false}`; on phones it never does, so the keyboard comes up
	 * only when a field is tapped.
	 */
	let {
		open = $bindable(false),
		title,
		description,
		onBack,
		focusFirst = true,
		children
	}: {
		open: boolean;
		title: string;
		description?: string;
		onBack?: () => void;
		focusFirst?: boolean;
		children: Snippet;
	} = $props();

	const desktop = new MediaQuery('min-width: 768px');
	let content = $state<HTMLElement | null>(null);

	/** What counts as a field to focus first: a text box, a select or a picker. */
	const FIELD =
		'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([disabled])';

	function openAutoFocus(event: Event) {
		if (!focusFirst) {
			event.preventDefault();
			content?.focus({ preventScroll: true });
			return;
		}
		const root = content;
		if (!root) return;
		const field = root.querySelector<HTMLElement>(FIELD);
		if (field) {
			event.preventDefault();
			field.focus({ preventScroll: true });
			return;
		}
		// The form is still loading: the dialog focuses what it can, then the field once it appears,
		// unless the user has moved on to something else.
		const observer = new MutationObserver(() => {
			const later = root.querySelector<HTMLElement>(FIELD);
			if (!later) return;
			observer.disconnect();
			const active = document.activeElement;
			if (active === root || active?.matches('[data-slot="dialog-close"]'))
				later.focus({ preventScroll: true });
		});
		observer.observe(root, { childList: true, subtree: true });
		setTimeout(() => observer.disconnect(), 3000);
	}
</script>

{#snippet back()}
	{#if onBack}
		<Button variant="ghost" size="icon-sm" class="-my-1 -ml-1.5" onclick={onBack}>
			<ArrowLeftIcon />
			<span class="sr-only">{m.back()}</span>
		</Button>
	{/if}
{/snippet}

{#if desktop.current}
	<Dialog.Root bind:open>
		<Dialog.Content
			bind:ref={content}
			class="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
			onOpenAutoFocus={openAutoFocus}
			onInteractOutside={keepOpenForToasts}
		>
			<Dialog.Header>
				<div class="flex min-w-0 items-center gap-1 pr-8">
					{@render back()}
					<Dialog.Title class="min-w-0">{title}</Dialog.Title>
				</div>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			{@render children()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<BottomDrawer bind:open bind:ref={content}>
		{#snippet header()}
			<Sheet.Header class="pt-3">
				<div class="flex min-w-0 items-center gap-1">
					{@render back()}
					<Sheet.Title class="min-w-0">{title}</Sheet.Title>
				</div>
				{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
			</Sheet.Header>
		{/snippet}
		<div class="px-4">{@render children()}</div>
	</BottomDrawer>
{/if}
