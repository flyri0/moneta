<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { notifyError, runAction, type ActionError } from '$client/notify';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { occurrenceMemo } from '$domain/installments';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import { loadFormContext } from '$features/transactions/context';
	import AddAccountForm from '$features/accounts/AddAccountForm.svelte';
	import NoOpenAccounts from '$features/accounts/NoOpenAccounts.svelte';
	import { payeeDisplay, payeeText } from '$features/accounts/register';
	import type { FormContext, TransactionDraft } from '$features/transactions/form';
	import TransactionForm from '$features/transactions/TransactionForm.svelte';
	import {
		draftFromSchedule,
		newScheduleDraft,
		type ScheduleDraft,
		type ScheduleView
	} from './form';
	import ScheduleForm from './ScheduleForm.svelte';
	import ScheduleOverview from './ScheduleOverview.svelte';

	/**
	 * Adds a schedule (in `accountId` when given), or opens `schedule` on its overview, from which
	 * its next occurrence is entered, or it is edited or deleted. With `preset` 'installments', a
	 * new one starts as a purchase in installments already under way.
	 */
	let {
		open = $bindable(false),
		accountId,
		schedule = null,
		preset
	}: {
		open: boolean;
		accountId?: string;
		schedule?: ScheduleRow | null;
		preset?: 'installments';
	} = $props();

	const session = useSession();
	let ctx = $state.raw<FormContext | null>(null);
	let initial = $state.raw<ScheduleDraft | null>(null);
	/** The schedule's next occurrence, as the transaction to enter for it. */
	let entering = $state.raw<{ schedule: ScheduleRow; draft: TransactionDraft } | null>(null);
	let view = $state<ScheduleView>('main');
	let addingAccount = $state(false);
	let error = $state<ActionError | null>(null);
	let busy = $state(false);

	const title = $derived(
		addingAccount
			? m.accounts_add()
			: {
					overview: schedule ? payeeText(payeeDisplay(schedule)) : '',
					enter: m.schedule_enter_title(),
					main: schedule ? m.schedule_edit_title() : m.schedule_add_title(),
					repeat: m.schedule_frequency(),
					delete: m.schedule_delete_title(),
					'enter-many': m.schedule_enter_many_title()
				}[view]
	);

	/** Each screen goes back to the one it was opened from; the first has no way back. */
	const onBack = $derived.by(() => {
		if (addingAccount) return () => (addingAccount = false);
		if (view === 'repeat' || view === 'enter-many') return () => (view = 'main');
		if (schedule && view !== 'overview') return () => go('overview');
		return undefined;
	});

	async function load(existing: ScheduleRow | null, preferredAccount: string | undefined) {
		ctx = null;
		initial = null;
		entering = null;
		view = existing ? 'overview' : 'main';
		addingAccount = false;
		error = null;
		try {
			const context = await loadFormContext(session.api, session.money);
			if (!existing) {
				const openAccounts = context.accounts.filter((a) => !a.closed);
				const pick =
					openAccounts.find((a) => a.id === preferredAccount)?.id ?? openAccounts[0]?.id ?? '';
				initial = newScheduleDraft(pick, todayIso(), { installments: preset === 'installments' });
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

	function go(next: ScheduleView) {
		view = next;
		error = null;
	}

	/** The overview hands over the schedule as it is now, e.g. after an occurrence was skipped. */
	function edit(current: ScheduleRow) {
		if (!ctx) return;
		initial = draftFromSchedule(current, ctx);
		go('main');
	}

	function enter(current: ScheduleRow) {
		if (!ctx || current.nextDate === null) return;
		const draft = {
			...draftFromSchedule(current, ctx).txn,
			date: current.nextDate,
			memo: occurrenceMemo(current, current.nextIndex)
		};
		entering = { schedule: current, draft };
		go('enter');
	}

	async function remove() {
		if (!schedule || busy) return;
		const id = schedule.id;
		busy = true;
		error = await runAction(() => session.api.schedules.delete(id));
		busy = false;
		if (!error) open = false;
	}
</script>

<ResponsiveDialog bind:open {title} {onBack}>
	{#if !ctx}
		<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
	{:else if view === 'overview' && schedule}
		<ScheduleOverview
			scheduleId={schedule.id}
			onEnter={enter}
			onEdit={edit}
			onDelete={() => go('delete')}
		/>
	{:else if view === 'delete'}
		<ConfirmPanel
			body={m.schedule_delete_body()}
			confirmLabel={m.schedule_delete()}
			{error}
			{busy}
			onCancel={() => go('overview')}
			onConfirm={remove}
		/>
	{:else if addingAccount}
		<AddAccountForm onCreated={(id) => void load(schedule, id)} />
	{:else if !ctx.accounts.some((a) => !a.closed)}
		<NoOpenAccounts hasClosed={ctx.accounts.length > 0} onAdd={() => (addingAccount = true)} />
	{:else if view === 'enter' && entering}
		{@const { schedule: s, draft } = entering}
		{#key entering}
			<TransactionForm
				{ctx}
				initial={draft}
				editingId={null}
				onSave={(input) => session.api.schedules.enter(s.id, s.nextIndex, input)}
				onCancel={() => go('overview')}
				onDone={() => (open = false)}
			/>
		{/key}
	{:else if initial}
		{#key initial}
			<ScheduleForm
				{ctx}
				{initial}
				editingId={schedule?.id ?? null}
				bind:view
				onCancel={schedule ? () => go('overview') : undefined}
				onDone={() => (open = false)}
			/>
		{/key}
	{/if}
</ResponsiveDialog>
