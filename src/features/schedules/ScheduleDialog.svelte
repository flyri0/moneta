<script lang="ts">
	import { Button } from '$ui/button';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { notifyError } from '$client/notify';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import { loadFormContext } from '$features/transactions/context';
	import type { FormContext } from '$features/transactions/form';
	import { draftFromSchedule, newScheduleDraft, type ScheduleDraft } from './form';
	import ScheduleForm from './ScheduleForm.svelte';

	/** Adds a schedule (in `accountId` when given), or edits `schedule`. */
	let {
		open = $bindable(false),
		accountId,
		schedule = null
	}: { open: boolean; accountId?: string; schedule?: ScheduleRow | null } = $props();

	const session = useSession();
	let ctx = $state.raw<FormContext | null>(null);
	let initial = $state.raw<ScheduleDraft | null>(null);

	async function load(editing: ScheduleRow | null, preferredAccount: string | undefined) {
		ctx = null;
		initial = null;
		try {
			const context = await loadFormContext(session.api, session.money);
			if (editing) {
				initial = draftFromSchedule(editing, context);
			} else {
				const openAccounts = context.accounts.filter((a) => !a.closed);
				const pick =
					openAccounts.find((a) => a.id === preferredAccount)?.id ?? openAccounts[0]?.id ?? '';
				initial = newScheduleDraft(pick, todayIso());
			}
			ctx = context;
		} catch (err) {
			notifyError(err);
			open = false;
		}
	}

	$effect(() => {
		if (open) void load(schedule, accountId);
	});
</script>

<ResponsiveDialog bind:open title={schedule ? m.schedule_edit_title() : m.schedule_add_title()}>
	{#if ctx && initial}
		{#if ctx.accounts.some((a) => !a.closed)}
			{#key initial}
				<ScheduleForm
					{ctx}
					{initial}
					editingId={schedule?.id ?? null}
					onDone={() => (open = false)}
				/>
			{/key}
		{:else}
			<p class="text-muted-foreground">{m.transaction_no_accounts()}</p>
			<Button variant="outline" onclick={() => (open = false)}>{m.close()}</Button>
		{/if}
	{:else}
		<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
	{/if}
</ResponsiveDialog>
