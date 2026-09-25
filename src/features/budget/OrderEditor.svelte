<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import {
		dropCategory,
		dropGroup,
		moveCategory,
		moveGroup,
		toLayout,
		toPayload,
		type OrderLayout
	} from '$features/budget/order';
	import { shouldMove } from '$features/budget/sortable';
	import { DragController, type DragItem } from '$features/budget/sortable.svelte';
	import type { BudgetGroupView } from '$db/repos/budget';
	import { groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * "Edit order" mode. Groups and categories are dragged by their grips (mouse and touch alike),
	 * and the arrow buttons do the same one step at a time from the keyboard.
	 */
	let { groups, onDone }: { groups: BudgetGroupView[]; onDone: () => void } = $props();

	const session = useSession();
	// The editor starts from the order at the moment it opens.
	// svelte-ignore state_referenced_locally
	let layout = $state<OrderLayout>(toLayout(groups));
	let error = $state<ActionError | null>(null);

	// The layout when the drag began, restored on cancel, and where the ghost sits.
	let before: OrderLayout = [];
	let ghost = $state({ left: 0, width: 0, offset: 0 });

	const drag = new DragController({
		onStart: start,
		onMove: move,
		onCancel: () => (layout = before)
	});
	$effect(() => () => drag.destroy());

	const draggingGroups = $derived(drag.active?.kind === 'group');

	async function start(item: DragItem, handle: HTMLElement) {
		before = layout;
		const row = handle.closest<HTMLElement>('[data-order-row]')!.getBoundingClientRect();
		ghost = { left: row.left, width: row.width, offset: drag.pointer.y - row.top };
		if (item.kind !== 'group') return;
		// Groups fold down to their headers while one is dragged: keep the grabbed one under the pointer.
		const top = handle.getBoundingClientRect().top;
		await tick();
		window.scrollBy({ top: handle.getBoundingClientRect().top - top, behavior: 'instant' });
	}

	function move(x: number, y: number) {
		const item = drag.active;
		const hit = document.elementFromPoint(x, y);
		const section = hit?.closest<HTMLElement>('[data-order-group]');
		if (!item || !hit || !section) return;
		const groupId = section.dataset.orderGroup!;
		const over = layout.findIndex((g) => g.id === groupId);

		if (item.kind === 'group') {
			const from = layout.findIndex((g) => g.id === item.id);
			if (shouldMove(from, over, y, section.getBoundingClientRect()))
				layout = dropGroup(layout, item.id, over);
			return;
		}

		const target = layout[over].categories;
		const row = hit.closest<HTMLElement>('[data-order-category]');
		if (row) {
			const overIndex = target.findIndex((c) => c.id === row.dataset.orderCategory);
			const from = target.findIndex((c) => c.id === item.id);
			const rect = row.getBoundingClientRect();
			if (from !== -1) {
				if (shouldMove(from, overIndex, y, rect))
					layout = dropCategory(layout, item.id, groupId, overIndex);
			} else {
				// Coming from another group: land on whichever side of the row the pointer is.
				const after = y > rect.top + rect.height / 2;
				layout = dropCategory(layout, item.id, groupId, overIndex + (after ? 1 : 0));
			}
		} else if (hit.closest('[data-order-header]')) {
			if (target[0]?.id !== item.id) layout = dropCategory(layout, item.id, groupId, 0);
		} else if (!target.some((c) => c.id === item.id)) {
			layout = dropCategory(layout, item.id, groupId, target.length);
		}
	}

	async function save() {
		error = await runAction(() => session.api.categories.saveOrder(toPayload(layout)));
		if (!error) onDone();
	}
</script>

{#snippet grip(item: DragItem)}
	<span
		class="-m-1 flex cursor-grab items-center self-stretch p-1 text-muted-foreground active:cursor-grabbing"
		aria-hidden="true"
		data-testid="drag-handle"
		{@attach drag.handle(item)}
	>
		<GripVerticalIcon class="size-4" />
	</span>
{/snippet}

<div class="grid gap-3 p-3">
	<div class="flex items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">{m.order_hint()}</p>
		<div class="flex gap-2">
			<Button variant="ghost" onclick={onDone}>{m.cancel()}</Button>
			<Button onclick={save}>{m.save()}</Button>
		</div>
	</div>
	<FormMessage {error} />
	{#each layout as group, gi (group.id)}
		{@const dragged = drag.active?.id === group.id}
		<section
			class="rounded-lg border {dragged ? 'border-dashed opacity-40' : ''}"
			aria-label={groupLabel(group)}
			data-order-group={group.id}
			data-order-row
			animate:flip={{ duration: 150 }}
		>
			<div class="flex items-center gap-2 bg-muted/60 px-3 py-2 font-medium" data-order-header>
				{@render grip({ kind: 'group', id: group.id, label: groupLabel(group) })}
				<span class="flex-1 truncate">{groupLabel(group)}</span>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={m.order_move_up({ name: groupLabel(group) })}
					disabled={gi === 0}
					onclick={() => (layout = moveGroup(layout, group.id, -1))}><ArrowUpIcon /></Button
				>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={m.order_move_down({ name: groupLabel(group) })}
					disabled={gi === layout.length - 1}
					onclick={() => (layout = moveGroup(layout, group.id, 1))}><ArrowDownIcon /></Button
				>
			</div>
			{#if !draggingGroups}
				{#each group.categories as category (category.id)}
					<div
						class="flex items-center gap-2 border-t px-3 py-1.5 {drag.active?.id === category.id
							? 'border-dashed opacity-40'
							: ''}"
						role="listitem"
						data-order-category={category.id}
						data-order-row
						data-testid="order-category"
						animate:flip={{ duration: 150 }}
					>
						{@render grip({ kind: 'category', id: category.id, label: category.name })}
						<span class="flex-1 truncate">{category.name}</span>
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
					</div>
				{/each}
			{/if}
		</section>
	{/each}
</div>

{#if drag.active}
	{@const item = drag.active}
	<div
		class="pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 font-medium shadow-lg"
		style:top="{drag.pointer.y - ghost.offset}px"
		style:left="{ghost.left}px"
		style:width="{ghost.width}px"
		aria-hidden="true"
	>
		<GripVerticalIcon class="size-4 text-muted-foreground" />
		<span class="flex-1 truncate">{item.label}</span>
		{#if item.kind === 'group'}
			<span class="text-sm text-muted-foreground tabular-nums">
				{layout.find((g) => g.id === item.id)?.categories.length}
			</span>
		{/if}
	</div>
{/if}
