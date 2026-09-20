<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ChevronsDownUpIcon from '@lucide/svelte/icons/chevrons-down-up';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import AddGroupDialog from '$lib/components/budget/AddGroupDialog.svelte';
	import BudgetGrid from '$lib/components/budget/BudgetGrid.svelte';
	import CategorySheet from '$lib/components/budget/CategorySheet.svelte';
	import GroupSheet from '$lib/components/budget/GroupSheet.svelte';
	import MonthPicker from '$lib/components/budget/MonthPicker.svelte';
	import OrderEditor from '$lib/components/budget/OrderEditor.svelte';
	import RtaCard from '$lib/components/budget/RtaCard.svelte';
	import { useSession } from '$lib/client/app-state.svelte';
	import { useLive } from '$lib/client/live.svelte';
	import {
		allCollapsed,
		loadCollapsed,
		saveCollapsed,
		toggleAll,
		toggleCollapsed
	} from '$lib/budget/collapse';
	import { BUDGET_TABLES, gridModel } from '$lib/budget/view';
	import { errorMessage } from '$lib/i18n/errors';
	import { formatMonthLong } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const session = useSession();
	const view = useLive(session.client, BUDGET_TABLES, () => session.api.budget.month(data.month));
	const model = $derived(view.data ? gridModel(view.data) : null);

	let categoryId = $state<string | null>(null);
	let groupId = $state<string | null>(null);
	let categoryOpen = $state(false);
	let groupOpen = $state(false);
	let addingGroup = $state(false);
	let editingOrder = $state(false);

	// Which groups are folded shut. A per-device convenience, so it lives outside the budget file.
	let collapsed = $state<ReadonlySet<string>>(loadCollapsed(localStorage, session.file));
	const everyCollapsed = $derived(allCollapsed(model?.groups ?? [], collapsed));

	function setCollapsed(next: Set<string>) {
		collapsed = next;
		saveCollapsed(localStorage, session.file, next);
	}

	// Look selections up in the live view so sheets show fresh numbers after each write.
	const category = $derived(
		view.data?.groups.flatMap((g) => g.categories).find((c) => c.id === categoryId) ?? null
	);
	// Only the grid's visible groups/categories: quick-assign must not touch hidden categories.
	const group = $derived(model?.groups.find((g) => g.id === groupId) ?? null);
</script>

<div class="mx-auto grid max-w-5xl gap-4 p-3 md:p-6">
	<!-- Side by side only from 1024px up: below that the month picker has no room next to the card. -->
	<header class="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-center">
		<MonthPicker month={data.month} />
		{#if view.data}<RtaCard view={view.data} />{/if}
	</header>

	{#if view.data?.futureNegativeMonth}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>{m.budget_future_negative_title()}</Alert.Title>
			<Alert.Description>
				{m.budget_future_negative_body({
					month: formatMonthLong(view.data.futureNegativeMonth, getLocale())
				})}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if view.error && !view.data}
		<p class="text-destructive" role="alert">{errorMessage(view.error)}</p>
	{/if}

	{#if view.data && model}
		{#if editingOrder}
			<OrderEditor groups={view.data.groups} onDone={() => (editingOrder = false)} />
		{:else}
			<!-- Labels only from 768px up: three labelled buttons do not fit a phone. -->
			<div class="flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					aria-label={everyCollapsed ? m.budget_expand_all() : m.budget_collapse_all()}
					onclick={() => setCollapsed(toggleAll(model.groups, collapsed))}
				>
					{#if everyCollapsed}
						<ChevronsUpDownIcon />
						<span class="hidden md:inline">{m.budget_expand_all()}</span>
					{:else}
						<ChevronsDownUpIcon />
						<span class="hidden md:inline">{m.budget_collapse_all()}</span>
					{/if}
				</Button>
				<Button
					variant="outline"
					size="sm"
					aria-label={m.budget_add_group()}
					onclick={() => (addingGroup = true)}
				>
					<PlusIcon />
					<span class="hidden md:inline">{m.budget_add_group()}</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					aria-label={m.budget_edit_order()}
					onclick={() => (editingOrder = true)}
				>
					<ArrowUpDownIcon />
					<span class="hidden md:inline">{m.budget_edit_order()}</span>
				</Button>
			</div>
			<BudgetGrid
				{model}
				month={data.month}
				{collapsed}
				onToggleGroup={(id) => setCollapsed(toggleCollapsed(collapsed, id))}
				onSelectCategory={(id) => {
					categoryId = id;
					categoryOpen = true;
				}}
				onSelectGroup={(id) => {
					groupId = id;
					groupOpen = true;
				}}
			/>
		{/if}

		{#if category}
			<CategorySheet
				bind:open={categoryOpen}
				{category}
				month={data.month}
				{model}
				groups={view.data.groups}
			/>
		{/if}
		{#if group}
			<GroupSheet bind:open={groupOpen} {group} month={data.month} />
		{/if}
	{/if}
</div>

<AddGroupDialog bind:open={addingGroup} />
<svelte:head><title>{m.nav_budget()} · {m.app_name()}</title></svelte:head>
