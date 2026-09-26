<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ChevronsDownUpIcon from '@lucide/svelte/icons/chevrons-down-up';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { Skeleton } from '$ui/skeleton';
	import Delayed from '$components/Delayed.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import AddGroupDialog from '$features/budget/AddGroupDialog.svelte';
	import BudgetGrid from '$features/budget/BudgetGrid.svelte';
	import CategorySheet from '$features/budget/CategorySheet.svelte';
	import GroupSheet from '$features/budget/GroupSheet.svelte';
	import MonthPicker from '$features/budget/MonthPicker.svelte';
	import OrderEditor from '$features/budget/OrderEditor.svelte';
	import RtaCard from '$features/budget/RtaCard.svelte';
	import { scrollLimits } from '$features/budget/sortable.svelte';
	import { RTA_CHIP, RTA_ICON } from '$features/budget/tones';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import {
		allCollapsed,
		loadCollapsed,
		saveCollapsed,
		toggleAll,
		toggleCollapsed
	} from '$features/budget/collapse';
	import { BUDGET_TABLES, gridModel, rtaTone } from '$features/budget/view';
	import { currentMonth } from '$domain/month';
	import { formatMonthLong } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const session = useSession();
	const view = useLive(session.client, BUDGET_TABLES, () => session.api.budget.month(data.month));
	const model = $derived(view.data ? gridModel(view.data) : null);

	let rtaCard = $state<HTMLElement>();
	/** Whether any of the Ready to Assign card shows below the sticky bars at the top. */
	let rtaInView = $state(true);
	const rtaState = $derived(view.data ? rtaTone(view.data.readyToAssign) : 'assigned');
	const RtaIcon = $derived(RTA_ICON[rtaState]);
	// Once the card scrolls away, the header keeps an amount that needs attention in sight.
	const showRtaChip = $derived(rtaState !== 'assigned' && !rtaInView);

	$effect(() => {
		const card = rtaCard;
		if (!card) return;
		const observer = new IntersectionObserver(([entry]) => (rtaInView = entry.isIntersecting), {
			rootMargin: `-${Math.ceil(scrollLimits().top)}px 0px 0px 0px`
		});
		observer.observe(card);
		return () => observer.disconnect();
	});

	function showRta() {
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		rtaCard?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
		rtaCard?.querySelector('button')?.focus({ preventScroll: true });
	}

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

<!-- Beside the month on desktop, where its fixed width keeps the arrows still. On phones the month
spans the row, so the chip joins the actions below it instead. -->
{#snippet rtaChip(display: string)}
	{#if showRtaChip && view.data}
		<button
			type="button"
			onclick={showRta}
			aria-label={m.budget_rta_chip({ amount: session.format(view.data.readyToAssign) })}
			data-testid="rta-chip"
			class="{display} shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium tabular-nums {RTA_CHIP[
				rtaState
			]}"
		>
			<RtaIcon class="size-3.5 shrink-0" aria-hidden="true" />
			{session.format(view.data.readyToAssign)}
		</button>
	{/if}
{/snippet}

<PageHeader>
	{#snippet title()}
		<div class="flex min-w-0 items-center gap-2">
			<div class="min-w-0 flex-1 md:flex-none"><MonthPicker month={data.month} /></div>
			{@render rtaChip('hidden md:inline-flex')}
		</div>
	{/snippet}
	{#snippet actions()}
		{@render rtaChip('inline-flex md:hidden')}
		<!-- Here rather than beside the arrows, where appearing would move them under the pointer. -->
		{#if data.month !== currentMonth()}
			<Button
				variant="outline"
				size="sm"
				href={resolve('/budget/[month]', { month: currentMonth() })}
			>
				{m.budget_this_month()}
			</Button>
		{/if}
		{#if model && !editingOrder}
			<!-- Labels only from 768px up: three labelled buttons do not fit a phone. -->
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
		{/if}
	{/snippet}
</PageHeader>

<!-- Dimmed while another month's figures are on their way. -->
<div
	class="mx-auto grid max-w-2xl gap-4 p-3 transition-opacity aria-busy:opacity-60 aria-busy:delay-150 md:p-6 lg:max-w-5xl"
	aria-busy={view.stale}
>
	{#if view.data}<RtaCard view={view.data} bind:ref={rtaCard} />{/if}

	{#if view.data?.futureNegativeMonth}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon class="size-4" />
			<Alert.Title>{m.budget_future_negative_title()}</Alert.Title>
			<Alert.Description>
				{m.budget_future_negative_body({
					month: formatMonthLong(view.data.futureNegativeMonth, getLocale())
				})}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if view.error && !view.data}
		<FormMessage error={actionError(view.error)} />
	{:else if !view.data}
		<Delayed>
			<div class="grid animate-in gap-4 fade-in" aria-hidden="true" data-testid="budget-loading">
				<Skeleton class="h-24 rounded-xl" />
				{#each { length: 3 }, i (i)}
					<div class="overflow-hidden rounded-xl border bg-card">
						<LoadingRows rows={4} delay={0} />
					</div>
				{/each}
			</div>
		</Delayed>
	{/if}

	{#if view.data && model}
		{#if editingOrder}
			<OrderEditor groups={view.data.groups} onDone={() => (editingOrder = false)} />
		{:else}
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
			<GroupSheet bind:open={groupOpen} {group} groups={view.data.groups} month={data.month} />
		{/if}
	{/if}
</div>

<AddGroupDialog bind:open={addingGroup} />
<svelte:head><title>{m.nav_budget()} · {m.app_name()}</title></svelte:head>
