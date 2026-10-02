<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { flip } from 'svelte/animate';
	import { Button } from '$ui/button';
	import { Switch } from '$ui/switch';
	import EditBar from '$components/EditBar.svelte';
	import { shouldMove } from '$features/budget/sortable';
	import { DragController, type DragItem } from '$features/budget/sortable.svelte';
	import { REPORTS } from '$features/reports/catalog';
	import {
		DEFAULT_LAYOUT,
		dropCard,
		moveCard,
		toggleHidden,
		type ReportId,
		type ReportsLayout
	} from '$features/reports/layout';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * "Customize" mode of the overview: reports are dragged by their grips (mouse and touch alike)
	 * or moved with the arrows, and switched off to hide them. Nothing changes until Save.
	 */
	let {
		layout: initial,
		onSave,
		onCancel
	}: {
		layout: ReportsLayout;
		onSave: (layout: ReportsLayout) => void;
		onCancel: () => void;
	} = $props();

	// The editor starts from the layout at the moment it opens.
	// svelte-ignore state_referenced_locally
	let layout = $state<ReportsLayout>(initial);

	// The layout when the drag began, restored on cancel, and where the ghost sits.
	let before: ReportsLayout = DEFAULT_LAYOUT;
	let ghost = $state({ left: 0, width: 0, offset: 0 });

	const drag = new DragController({
		onStart: (_item, handle) => {
			before = layout;
			const row = handle.closest<HTMLElement>('[data-report-row]')!.getBoundingClientRect();
			ghost = { left: row.left, width: row.width, offset: drag.pointer.y - row.top };
		},
		onMove: move,
		onCancel: () => (layout = before)
	});
	$effect(() => () => drag.destroy());

	function move(x: number, y: number) {
		const item = drag.active;
		const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-report-row]');
		if (!item || !row) return;
		const id = item.id as ReportId;
		const over = layout.order.indexOf(row.dataset.reportRow as ReportId);
		if (shouldMove(layout.order.indexOf(id), over, y, row.getBoundingClientRect()))
			layout = dropCard(layout, id, over);
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

<!-- Each report folds down to a card's title row, so they are short enough to drag past one another. -->
<ul class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 pb-28 md:pb-0" data-testid="reports-editor">
	{#each layout.order as id, i (id)}
		{@const title = REPORTS[id].title()}
		{@const shown = !layout.hidden.includes(id)}
		<li
			class="flex items-center gap-1.5 rounded-xl border bg-card px-4 py-3 text-card-foreground transition-opacity sm:gap-2 {drag
				.active?.id === id
				? 'border-dashed opacity-40'
				: shown
					? ''
					: 'opacity-50'}"
			data-report-row={id}
			data-shown={shown}
			data-testid="report-row"
			animate:flip={{ duration: 150 }}
		>
			{@render grip({ kind: 'card', id, label: title })}
			<span class="min-w-0 flex-1 truncate text-xs font-medium tracking-wide uppercase"
				>{title}</span
			>
			<Switch
				checked={shown}
				aria-label={m.reports_show_report({ name: title })}
				onCheckedChange={() => (layout = toggleHidden(layout, id))}
			/>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={m.order_move_up({ name: title })}
				disabled={i === 0}
				onclick={() => (layout = moveCard(layout, id, -1))}><ArrowUpIcon /></Button
			>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={m.order_move_down({ name: title })}
				disabled={i === layout.order.length - 1}
				onclick={() => (layout = moveCard(layout, id, 1))}><ArrowDownIcon /></Button
			>
		</li>
	{/each}
</ul>

<EditBar label={m.reports_customize()} testId="reports-bar" passThrough={!!drag.active}>
	<div class="grid gap-2 p-2">
		<p class="px-1 text-sm text-muted-foreground">{m.reports_customize_hint()}</p>
		<div class="grid grid-cols-[auto_1fr_1fr] gap-2">
			<Button
				variant="ghost"
				aria-label={m.reports_restore_default()}
				onclick={() => (layout = DEFAULT_LAYOUT)}
			>
				<RotateCcwIcon class="size-4" />
				<span class="hidden sm:inline">{m.reports_restore_default()}</span>
			</Button>
			<Button variant="outline" onclick={onCancel}>{m.cancel()}</Button>
			<Button onclick={() => onSave(layout)}>{m.save()}</Button>
		</div>
	</div>
</EditBar>

{#if drag.active}
	<div
		class="pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg"
		style:top="{drag.pointer.y - ghost.offset}px"
		style:left="{ghost.left}px"
		style:width="{ghost.width}px"
		aria-hidden="true"
	>
		<GripVerticalIcon class="size-4 text-muted-foreground" />
		<span class="flex-1 truncate">{drag.active.label}</span>
	</div>
{/if}
