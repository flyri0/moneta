<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';

	/** A dialog on desktop and a bottom sheet on phones (below 768px). */
	let {
		open = $bindable(false),
		title,
		description,
		children
	}: { open: boolean; title: string; description?: string; children: Snippet } = $props();

	const desktop = new MediaQuery('min-width: 768px');
</script>

{#if desktop.current}
	<Dialog.Root bind:open>
		<Dialog.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			{@render children()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open>
		<Sheet.Content side="bottom" class="max-h-[90dvh] overflow-y-auto">
			<Sheet.Header>
				<Sheet.Title>{title}</Sheet.Title>
				{#if description}<Sheet.Description>{description}</Sheet.Description>{/if}
			</Sheet.Header>
			<div class="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{@render children()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
