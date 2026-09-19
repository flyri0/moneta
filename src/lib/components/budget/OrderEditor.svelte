<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { Button } from '$lib/components/ui/button';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import {
		dropCategory,
		moveCategory,
		moveGroup,
		toLayout,
		toPayload,
		type OrderLayout
	} from '$lib/budget/order';
	import type { BudgetGroupView } from '$lib/db/repos/budget';
	import { groupLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';

	/**
	 * "Edit order" mode. Arrow buttons work everywhere (the phone path); on desktop, categories
	 * can also be dragged with the mouse (HTML5 drag and drop does not fire on touch screens).
	 */
	let { groups, onDone }: { groups: BudgetGroupView[]; onDone: () => void } = $props();

	const session = useSession();
	// The editor starts from the order at the moment it opens.
	// svelte-ignore state_referenced_locally
	let layout = $state<OrderLayout>(toLayout(groups));
	let dragging = $state<string | null>(null);
	let error = $state<string | null>(null);

	function drop(event: DragEvent, groupId: string, index: number) {
		event.preventDefault();
		if (dragging) layout = dropCategory(layout, dragging, groupId, index);
		dragging = null;
	}

	async function save() {
		error = await runAction(() => session.api.categories.saveOrder(toPayload(layout)));
		if (!error) onDone();
	}
</script>

<div class="grid gap-3 p-3">
	<div class="flex items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">{m.order_hint()}</p>
		<div class="flex gap-2">
			<Button variant="ghost" onclick={onDone}>{m.cancel()}</Button>
			<Button onclick={save}>{m.save()}</Button>
		</div>
	</div>
	{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
	{#each layout as group, gi (group.id)}
		<section
			class="rounded-lg border"
			aria-label={groupLabel(group)}
			ondragover={(e) => e.preventDefault()}
			ondrop={(e) => drop(e, group.id, group.categories.length)}
		>
			<div class="flex items-center gap-2 bg-muted/60 px-3 py-2 font-medium">
				<span class="flex-1 truncate">{groupLabel(group)}</span>
				{#if !group.system}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={m.order_move_up({ name: group.name })}
						disabled={gi === 0 || layout[gi - 1].system !== null}
						onclick={() => (layout = moveGroup(layout, group.id, -1))}><ArrowUpIcon /></Button
					>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={m.order_move_down({ name: group.name })}
						disabled={gi === layout.length - 1}
						onclick={() => (layout = moveGroup(layout, group.id, 1))}><ArrowDownIcon /></Button
					>
				{/if}
			</div>
			{#each group.categories as category, ci (category.id)}
				<div
					class="flex items-center gap-2 border-t px-3 py-1.5 {dragging === category.id
						? 'opacity-50'
						: ''}"
					role="listitem"
					draggable={!group.system}
					ondragstart={(e) => {
						dragging = category.id;
						e.dataTransfer?.setData('text/plain', category.id);
					}}
					ondragend={() => (dragging = null)}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.stopPropagation();
						drop(e, group.id, ci);
					}}
				>
					{#if !group.system}
						<GripVerticalIcon class="hidden size-4 cursor-grab text-muted-foreground md:block" />
					{/if}
					<span class="flex-1 truncate">{category.name}</span>
					{#if !group.system}
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.order_move_up({ name: category.name })}
							onclick={() => (layout = moveCategory(layout, category.id, -1))}
							><ArrowUpIcon /></Button
						>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.order_move_down({ name: category.name })}
							onclick={() => (layout = moveCategory(layout, category.id, 1))}
							><ArrowDownIcon /></Button
						>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>
