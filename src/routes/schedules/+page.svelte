<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$ui/button';
	import ScheduleDialog from '$features/schedules/ScheduleDialog.svelte';
	import ScheduleList from '$features/schedules/ScheduleList.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { todayIso } from '$domain/month';
	import { errorMessage } from '$i18n/errors';
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

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-xl font-semibold">{m.nav_schedules()}</h1>
		<Button onclick={() => open(null)}><PlusIcon />{m.schedules_add()}</Button>
	</header>

	{#if schedules.error && !schedules.data}
		<p class="text-destructive" role="alert">{errorMessage(schedules.error)}</p>
	{:else if schedules.data?.length === 0}
		<div class="rounded-xl border bg-card p-8 text-center text-card-foreground shadow-xs">
			<p class="text-sm text-muted-foreground">{m.schedules_empty()}</p>
		</div>
	{:else if schedules.data}
		<ScheduleList schedules={schedules.data} onOpen={open} />
	{/if}
</div>

<ScheduleDialog bind:open={dialogOpen} schedule={selected} />
<svelte:head><title>{m.nav_schedules()} · {m.app_name()}</title></svelte:head>
