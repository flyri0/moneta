<script lang="ts">
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$ui/button';
	import EmptyState from '$components/EmptyState.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import LoadingRows from '$components/LoadingRows.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import TransactionsTabs from '$features/transactions/TransactionsTabs.svelte';
	import ScheduleDialog from '$features/schedules/ScheduleDialog.svelte';
	import ScheduleList from '$features/schedules/ScheduleList.svelte';
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

	let dialogOpen = $state(false);
	let selected = $state<ScheduleRow | null>(null);

	function open(schedule: ScheduleRow | null) {
		selected = schedule;
		dialogOpen = true;
	}
</script>

<PageHeader title={m.nav_transactions()}>
	{#snippet actions()}
		<Button size="sm" onclick={() => open(null)}>
			<PlusIcon />
			{m.schedules_add()}
		</Button>
	{/snippet}
	{#snippet toolbar()}<TransactionsTabs />{/snippet}
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
	{:else if schedules.data}
		<ScheduleList schedules={schedules.data} onOpen={open} />
	{:else}
		<div class="overflow-hidden rounded-xl border bg-card shadow-xs"><LoadingRows /></div>
	{/if}
</div>

<ScheduleDialog bind:open={dialogOpen} schedule={selected} />
<svelte:head><title>{m.nav_schedules()} · {m.app_name()}</title></svelte:head>
