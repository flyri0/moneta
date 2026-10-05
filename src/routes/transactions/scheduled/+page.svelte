<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$ui/button';
	import EmptyState from '$components/EmptyState.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import TransactionsTabs from '$features/transactions/TransactionsTabs.svelte';
	import ScheduleDialog from '$features/schedules/ScheduleDialog.svelte';
	import ScheduleList from '$features/schedules/ScheduleList.svelte';
	import ScheduleToolbar from '$features/schedules/ScheduleToolbar.svelte';
	import { filterSchedules } from '$features/schedules/filters';
	import { ScheduleFilters } from '$features/schedules/filters.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError } from '$client/notify';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	const session = useSession();
	const schedules = useLive(
		session.client,
		['schedules', 'schedule_splits', 'accounts', 'payees', 'categories'],
		() => session.api.schedules.list(todayIso())
	);

	const filters = new ScheduleFilters();
	const filtered = $derived(
		schedules.data && filterSchedules(schedules.data, filters.search, filters, session.money)
	);

	let dialogOpen = $state(false);
	let selected = $state<ScheduleRow | null>(null);
	let preset = $state<'installments' | undefined>();
	let presetAccount = $state<string | undefined>();

	function open(schedule: ScheduleRow | null) {
		selected = schedule;
		preset = undefined;
		presetAccount = undefined;
		dialogOpen = true;
	}

	// `?add=installments&account=…` (from a card purchase) opens a purchase in installments
	// already under way. The query is dropped at once, replacing the history entry (a shallow
	// replaceState would keep it there), so neither a reload nor Back opens it again. The dialog
	// falls back to another account when that one isn't open.
	$effect(() => {
		const params = page.url.searchParams;
		if (params.get('add') !== 'installments') return;
		const account = params.get('account') ?? undefined;
		untrack(() => {
			open(null);
			preset = 'installments';
			presetAccount = account;
		});
		void goto(resolve('/transactions/scheduled'), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});
</script>

<PageHeader title={m.nav_transactions()}>
	{#snippet actions()}
		<Button size="sm" onclick={() => open(null)}>
			<PlusIcon />
			{m.schedules_add()}
		</Button>
	{/snippet}
	{#snippet toolbar()}
		<TransactionsTabs />
		{#if schedules.data?.length}
			<ScheduleToolbar {filters} schedules={schedules.data} />
		{/if}
	{/snippet}
</PageHeader>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{#if schedules.error && !schedules.data}
		<FormMessage error={actionError(schedules.error)} />
	{:else if schedules.data?.length === 0}
		<EmptyState
			framed
			icon={CalendarClockIcon}
			title={m.schedules_empty_title()}
			description={m.schedules_empty()}
		>
			<Button size="sm" onclick={() => open(null)}>
				<PlusIcon />
				{m.schedules_add()}
			</Button>
		</EmptyState>
	{:else if filtered?.length === 0}
		<EmptyState framed icon={SearchXIcon} description={m.schedules_no_results()}>
			<Button size="sm" variant="outline" onclick={() => filters.clear()}>
				<XIcon />
				{m.register_clear_filters()}
			</Button>
		</EmptyState>
	{:else if filtered}
		<ScheduleList schedules={filtered} onOpen={open} />
	{:else}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs"><LoadingRows /></div>
	{/if}
</div>

<ScheduleDialog bind:open={dialogOpen} schedule={selected} {preset} accountId={presetAccount} />
<svelte:head><title>{m.nav_schedules()} · {m.app_name()}</title></svelte:head>
