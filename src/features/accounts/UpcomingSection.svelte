<script lang="ts">
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import { payeeDisplay, payeeText } from '$features/accounts/register';
	import { collapseOverdue } from '$features/accounts/upcoming';
	import ScheduleDialog from '$features/schedules/ScheduleDialog.svelte';
	import type { OccurrenceToEnter } from '$features/schedules/form';
	import TransactionDialog from '$features/transactions/TransactionDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { notifyError, runActionToast } from '$client/notify';
	import type { ScheduleRow, UpcomingOccurrence } from '$db/repos/schedules';
	import { todayIso } from '$domain/month';
	import { formatDate } from '$i18n/formats';
	import { storedCategoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * An account's scheduled occurrences for the next days, each with the balance it leaves.
	 * Each schedule's next occurrence can be entered, skipped, or its schedule edited.
	 */
	let { occurrences, balances }: { occurrences: UpcomingOccurrence[]; balances: number[] } =
		$props();

	const session = useSession();
	const rows = $derived(collapseOverdue(occurrences));
	let entering = $state<OccurrenceToEnter | null>(null);
	let enterOpen = $state(false);
	let editing = $state<ScheduleRow | null>(null);
	let editOpen = $state(false);

	async function scheduleOf(o: UpcomingOccurrence): Promise<ScheduleRow | null> {
		try {
			return await session.api.schedules.get(o.scheduleId, todayIso());
		} catch (err) {
			notifyError(err);
			return null;
		}
	}

	async function enter(o: UpcomingOccurrence) {
		const schedule = await scheduleOf(o);
		if (!schedule) return;
		entering = { schedule, index: o.index, date: o.date };
		enterOpen = true;
	}

	async function edit(o: UpcomingOccurrence) {
		editing = await scheduleOf(o);
		if (editing) editOpen = true;
	}

	/** The occurrence's date, and its category when it has one. */
	function detail(o: UpcomingOccurrence): string {
		const date = formatDate(o.date, getLocale());
		return o.categoryName ? `${date} · ${storedCategoryLabel(o.categoryName)}` : date;
	}

	function skip(o: UpcomingOccurrence) {
		void runActionToast(() => session.api.schedules.skip(o.scheduleId, o.index));
	}
</script>

<section class="grid gap-2" aria-label={m.schedules_upcoming()}>
	<h2 class="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
		{m.schedules_upcoming()}
	</h2>
	<ul class="divide-y overflow-hidden rounded-xl border border-dashed bg-card text-card-foreground">
		{#each rows as { occurrence: o, position: i, moreOverdue } (`${o.scheduleId}:${o.index}`)}
			<li
				class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3"
				data-testid="upcoming-row"
			>
				<span class="flex min-w-0 items-center gap-2">
					<span class="truncate text-sm font-medium">{payeeText(payeeDisplay(o))}</span>
					{#if o.due}<Badge variant="destructive">{m.upcoming_due()}</Badge>{/if}
					{#if moreOverdue > 0}
						<Badge variant="outline" data-testid="upcoming-more-overdue">
							{m.upcoming_more_overdue({ count: moreOverdue })}
						</Badge>
					{/if}
				</span>
				<span
					class="text-right text-sm font-semibold tabular-nums {o.amount < 0
						? ''
						: 'text-emerald-700 dark:text-emerald-400'}"
					data-testid="upcoming-amount"
				>
					{session.format(o.amount)}
				</span>
				<span class="min-w-0 truncate text-xs text-muted-foreground">
					{detail(o)}
				</span>
				<span class="text-right text-xs text-muted-foreground tabular-nums">
					<span class="sr-only">{m.upcoming_projected()}:</span>
					<span data-testid="upcoming-balance">{session.format(balances[i])}</span>
				</span>
				{#if o.isNext}
					<div class="col-span-2 flex flex-wrap gap-2">
						<Button size="sm" variant="outline" onclick={() => enter(o)}>
							{m.upcoming_enter()}
						</Button>
						<Button size="sm" variant="ghost" onclick={() => skip(o)}>{m.upcoming_skip()}</Button>
						<Button size="sm" variant="ghost" onclick={() => edit(o)}>
							{m.schedule_edit_title()}
						</Button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<TransactionDialog bind:open={enterOpen} occurrence={entering} />
<ScheduleDialog bind:open={editOpen} schedule={editing} />
