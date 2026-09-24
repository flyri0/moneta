<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$ui/button';
	import * as Dialog from '$ui/dialog';
	import * as Sheet from '$ui/sheet';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * A dialog on desktop and a bottom sheet on phones (below 768px). `onBack` adds a back button
	 * before the title, for screens nested inside one dialog.
	 */
	let {
		open = $bindable(false),
		title,
		description,
		onBack,
		children
	}: {
		open: boolean;
		title: string;
		description?: string;
		onBack?: () => void;
		children: Snippet;
	} = $props();

	const desktop = new MediaQuery('min-width: 768px');
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
		<Dialog.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
	<Sheet.Root bind:open>
		<Sheet.Content side="bottom" class="max-h-[90dvh] overflow-y-auto">
			<Sheet.Header>
				<div class="flex min-w-0 items-center gap-1 pr-8">
					{@render back()}
					<Sheet.Title class="min-w-0">{title}</Sheet.Title>
				</div>
				{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
			</Sheet.Header>
			<div class="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{@render children()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
