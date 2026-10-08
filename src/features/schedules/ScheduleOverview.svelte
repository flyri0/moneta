<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import SheetLink from '$components/SheetLink.svelte';
	import { payeeDisplay } from '$features/accounts/register';
	import SplitLines from '$features/transactions/SplitLines.svelte';
	import FlagIcon from '$features/flags/FlagIcon.svelte';
	import { flagLabel } from '$features/flags/flags';
	import { useFlags } from '$features/flags/use-flags.svelte';
	import Amount from '$components/Amount.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { actionError, runActionToast } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { todayIso } from '$domain/month';
	import { formatDate } from '$i18n/formats';
	import { storedCategoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { nextOccurrences, ruleSummary, scheduleInstallments } from './form';

	/**
	 * What a schedule does and when it comes next, kept live. Its next occurrence can be entered or
	 * skipped from here; editing and deleting are one tap away.
	 */
	let {
		scheduleId,
		onEnter,
		onEdit,
		onDelete
	}: {
		scheduleId: string;
		onEnter: (schedule: ScheduleRow) => void;
		onEdit: (schedule: ScheduleRow) => void;
		onDelete: () => void;
	} = $props();

	const session = useSession();
	const flags = useFlags();
	const live = useLive(
		session.client,
		['schedules', 'schedule_splits', 'accounts', 'payees', 'categories'],
		() => session.api.schedules.get(scheduleId, todayIso())
	);
	const s = $derived(live.data);
	const payee = $derived(s ? payeeDisplay(s) : null);
	const installments = $derived(s ? scheduleInstallments(s) : null);
	const upcoming = $derived(s && s.status !== 'paused' ? nextOccurrences(s, 4) : []);
	const total = $derived(
		s && s.installmentStart !== null && s.endCount !== null
			? s.installmentStart + s.endCount - 1
			: null
	);
	let busy = $state(false);

	async function skip(schedule: ScheduleRow) {
		busy = true;
		const call = session.api.schedules.skip(schedule.id, schedule.nextIndex);
		await runActionToast(async () => {
			await call;
			offerUndo(session.client, call, m.schedule_skipped());
		});
		busy = false;
	}
</script>

{#if s}
	<div class="grid gap-4" data-testid="schedule-overview">
		<div class="grid gap-2">
			<Amount
				amount={s.amount}
				flow
				class="text-2xl font-semibold"
				data-testid="schedule-overview-amount"
			/>
			<div class="flex flex-wrap gap-1.5">
				{#if s.status === 'due'}
					<Badge variant="destructive">{m.schedules_due()}</Badge>
				{:else if s.status === 'paused'}
					<Badge variant="outline">{m.schedules_paused()}</Badge>
				{:else if s.status === 'ended'}
					<Badge variant="outline">{m.schedules_ended()}</Badge>
				{/if}
				{#if s.autoEnter}<Badge variant="secondary">{m.schedules_auto()}</Badge>{/if}
			</div>
		</div>

		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
			<dt class="text-muted-foreground">{m.transaction_account()}</dt>
			<dd class="min-w-0 text-right break-words">{s.accountName}</dd>

			{#if payee?.kind === 'transfer'}
				<dt class="text-muted-foreground">
					{payee.direction === 'to' ? m.overview_to() : m.overview_from()}
				</dt>
				<dd class="min-w-0 text-right break-words">{payee.accountName}</dd>
			{/if}

			{#if s.isSplit}
				<dt class="text-muted-foreground">{m.transaction_category()}</dt>
				<dd class="min-w-0 text-right">{m.register_split({ count: s.splits.length })}</dd>
				<dd class="col-span-2"><SplitLines lines={s.splits} /></dd>
			{:else if s.categoryName}
				<dt class="text-muted-foreground">{m.transaction_category()}</dt>
				<dd class="min-w-0 text-right break-words">{storedCategoryLabel(s.categoryName)}</dd>
			{/if}

			{#if s.memo}
				<dt class="text-muted-foreground">{m.transaction_memo()}</dt>
				<dd class="min-w-0 text-right break-words">{s.memo}</dd>
			{/if}

			{#if s.flag}
				<dt class="text-muted-foreground">{m.flag_label()}</dt>
				<dd class="flex min-w-0 items-center justify-end gap-1.5 text-right break-words">
					<FlagIcon color={s.flag} />
					{flagLabel(s.flag, flags.data)}
				</dd>
			{/if}

			<dt class="text-muted-foreground">{m.schedule_frequency()}</dt>
			<dd class="min-w-0 text-right">
				{#if installments}
					{m.schedules_installment({ n: installments.next, total: installments.total })}
					<span class="block text-xs text-muted-foreground" data-testid="schedule-overview-left">
						{m.schedule_overview_left({ count: installments.left })}{#if installments.sum !== null}
							· {m.schedule_installments_sum({ amount: session.format(installments.sum) })}{/if}
					</span>
				{:else}
					{ruleSummary(s)}
				{/if}
			</dd>
		</dl>

		{#if upcoming.length > 0}
			<section class="grid gap-2" aria-label={m.schedule_overview_next()}>
				<h3 class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
					{m.schedule_overview_next()}
				</h3>
				<ul class="divide-y rounded-lg border text-sm">
					{#each upcoming as o (o.index)}
						<li
							class="flex items-center justify-between gap-3 px-3 py-2"
							data-testid="schedule-overview-date"
						>
							<span class="tabular-nums">{formatDate(o.date, getLocale())}</span>
							{#if o.installment !== null && total !== null}
								<span class="text-xs text-muted-foreground tabular-nums">
									{o.installment}/{total}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<nav class="-mx-2 grid gap-0.5">
			<SheetLink icon={PencilIcon} label={m.schedule_edit_title()} onclick={() => onEdit(s)} />
			<SheetLink icon={Trash2Icon} label={m.schedule_delete()} destructive onclick={onDelete} />
		</nav>

		{#if upcoming.length > 0}
			<div class="grid grid-cols-2 gap-2">
				<Button variant="outline" disabled={busy} onclick={() => skip(s)}>
					{m.schedule_skip_next()}
				</Button>
				<Button disabled={busy} onclick={() => onEnter(s)}>{m.schedule_enter_next()}</Button>
			</div>
		{/if}
	</div>
{:else if live.error}
	<FormMessage error={actionError(live.error)} />
{:else}
	<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
{/if}
