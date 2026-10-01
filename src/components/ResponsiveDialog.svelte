<script lang="ts">
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
	 * before the title, for screens nested inside one dialog. `focusFirst={false}` keeps focus on the
	 * dialog itself when it opens instead of its first field, so a phone's keyboard stays down.
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

	function openAutoFocus(event: Event) {
		if (focusFirst) return;
		event.preventDefault();
		content?.focus({ preventScroll: true });
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
	<BottomDrawer bind:open bind:ref={content} onOpenAutoFocus={openAutoFocus}>
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
