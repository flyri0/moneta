<script lang="ts">
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import { Separator } from '$ui/separator';
	import { Switch } from '$ui/switch';
	import SheetLink from '$components/SheetLink.svelte';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { enterAndReport } from '$client/schedules';
	import { todayIso } from '$domain/month';
	import { FREQUENCIES, WEEKEND_RULES, type Frequency, type WeekendRule } from '$domain/schedule';
	import { m } from '$i18n/paraglide/messages';
	import { canSplit, splitRemaining, type FormContext } from '$features/transactions/form';
	import { FORM_ERRORS } from '$features/transactions/form-errors';
	import TransactionFields from '$features/transactions/TransactionFields.svelte';
	import {
		buildScheduleInput,
		draftRuleSummary,
		FREQUENCY_LABELS,
		type Ends,
		type ScheduleDraft,
		type ScheduleFormError,
		type ScheduleView
	} from './form';

	/**
	 * Adds a schedule, or edits the one `editingId` names. `view` is the screen: the transaction
	 * first, the repeat rule and delete one tap away. The draft is kept across screens.
	 */
	let {
		ctx,
		initial,
		editingId,
		view = $bindable(),
		onDone
	}: {
		ctx: FormContext;
		initial: ScheduleDraft;
		editingId: string | null;
		view: ScheduleView;
		onDone: () => void;
	} = $props();

	const session = useSession();
	// The dialog re-creates this form (with {#key}) for every schedule it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(initial));
	let error = $state<ActionError | null>(null);
	let busy = $state(false);

	const ERRORS: Record<ScheduleFormError, () => string> = {
		...FORM_ERRORS,
		INTERVAL_INVALID: m.form_error_interval_invalid,
		END_DATE_INVALID: m.form_error_end_date_invalid,
		END_COUNT_INVALID: m.form_error_end_count_invalid
	};
	const UNIT_LABELS: Record<Frequency, () => string> = {
		once: () => '',
		daily: m.schedule_unit_days,
		weekly: m.schedule_unit_weeks,
		monthly: m.schedule_unit_months,
		yearly: m.schedule_unit_years
	};
	const WEEKEND_LABELS: Record<WeekendRule, () => string> = {
		keep: m.schedule_weekend_keep,
		before: m.schedule_weekend_before,
		after: m.schedule_weekend_after
	};
	const ENDS: Ends[] = ['never', 'on', 'after'];
	const ENDS_LABELS: Record<Ends, () => string> = {
		never: m.schedule_ends_never,
		on: m.schedule_ends_on,
		after: m.schedule_ends_after
	};

	/** Split lines that don't add up yet keep Save disabled. */
	const blocked = $derived(
		draft.txn.splits !== null &&
			canSplit(draft.txn, ctx) &&
			splitRemaining(draft.txn, ctx.money) !== 0
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const result = buildScheduleInput(draft, ctx);
		if (!result.ok) {
			error = { message: ERRORS[result.error]() };
			return;
		}
		const input = result.input;
		busy = true;
		error = await runAction(() =>
			editingId
				? session.api.schedules.update(editingId, input)
				: session.api.schedules.create(input)
		);
		// An automatic schedule that is already due is entered now, not when the app next opens.
		if (!error && input.autoEnter && !session.isDemo)
			await enterAndReport(() => session.api.schedules.enterDue(todayIso()));
		busy = false;
		if (!error) onDone();
	}

	function go(next: ScheduleView) {
		view = next;
		error = null;
	}

	async function remove() {
		if (!editingId || busy) return;
		const id = editingId;
		busy = true;
		error = await runAction(() => session.api.schedules.delete(id));
		busy = false;
		if (!error) onDone();
	}
</script>

<form class="grid gap-4" onsubmit={save}>
	{#if view === 'main'}
		<TransactionFields {ctx} bind:draft={draft.txn} dateLabel={m.schedule_next_date()} />

		<div class="flex items-center justify-between gap-4 rounded-lg border p-3">
			<div class="grid gap-1">
				<Label for="schedule-auto">{m.schedule_auto_enter()}</Label>
				<p class="text-xs text-muted-foreground">
					{draft.autoEnter ? m.schedule_auto_enter_hint() : m.schedule_manual_hint()}
				</p>
			</div>
			<Switch id="schedule-auto" bind:checked={draft.autoEnter} />
		</div>

		<Separator />

		<nav class="-mx-2 grid gap-0.5">
			<SheetLink
				icon={RepeatIcon}
				label={m.schedule_frequency()}
				detail={draftRuleSummary(draft.rule)}
				onclick={() => go('repeat')}
			/>
			{#if editingId}
				<SheetLink
					icon={Trash2Icon}
					label={m.schedule_delete()}
					destructive
					onclick={() => go('delete')}
				/>
			{/if}
		</nav>

		<FormMessage {error} />

		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" onclick={onDone}>{m.cancel()}</Button>
			<Button type="submit" disabled={busy || blocked}>{m.save()}</Button>
		</div>
	{:else if view === 'repeat'}
		<div class="grid divide-y rounded-lg border">
			<div class="grid gap-2 p-3">
				<Label for="schedule-frequency">{m.schedule_frequency()}</Label>
				<Select.Root
					type="single"
					value={draft.rule.frequency}
					onValueChange={(v) => (draft.rule.frequency = v as Frequency)}
				>
					<Select.Trigger id="schedule-frequency" class="w-full">
						{FREQUENCY_LABELS[draft.rule.frequency]()}
					</Select.Trigger>
					<Select.Content>
						{#each FREQUENCIES as frequency (frequency)}
							<Select.Item value={frequency} label={FREQUENCY_LABELS[frequency]()}>
								{FREQUENCY_LABELS[frequency]()}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if draft.rule.frequency !== 'once'}
				<div class="grid gap-2 p-3">
					<Label for="schedule-interval">{m.schedule_interval()}</Label>
					<div class="flex items-center gap-2">
						<Input
							id="schedule-interval"
							bind:value={draft.rule.interval}
							inputmode="numeric"
							autocomplete="off"
							class="w-20"
						/>
						<span class="text-sm text-muted-foreground">
							{UNIT_LABELS[draft.rule.frequency]()}
						</span>
					</div>
				</div>

				{#if draft.rule.frequency !== 'daily'}
					<div class="grid gap-2 p-3">
						<Label for="schedule-weekend">{m.schedule_weekend()}</Label>
						<Select.Root
							type="single"
							value={draft.rule.weekend}
							onValueChange={(v) => (draft.rule.weekend = v as WeekendRule)}
						>
							<Select.Trigger id="schedule-weekend" class="w-full">
								{WEEKEND_LABELS[draft.rule.weekend]()}
							</Select.Trigger>
							<Select.Content>
								{#each WEEKEND_RULES as weekend (weekend)}
									<Select.Item value={weekend} label={WEEKEND_LABELS[weekend]()}>
										{WEEKEND_LABELS[weekend]()}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/if}

				<div class="grid gap-2 p-3">
					<Label for="schedule-ends">{m.schedule_ends()}</Label>
					<Select.Root
						type="single"
						value={draft.rule.ends}
						onValueChange={(v) => (draft.rule.ends = v as Ends)}
					>
						<Select.Trigger id="schedule-ends" class="w-full">
							{ENDS_LABELS[draft.rule.ends]()}
						</Select.Trigger>
						<Select.Content>
							{#each ENDS as ends (ends)}
								<Select.Item value={ends} label={ENDS_LABELS[ends]()}>
									{ENDS_LABELS[ends]()}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				{#if draft.rule.ends === 'on'}
					<div class="grid gap-2 p-3">
						<Label for="schedule-end-date">{m.schedule_end_date()}</Label>
						<DatePicker
							id="schedule-end-date"
							bind:value={draft.rule.endDate}
							ariaLabel={m.schedule_end_date()}
						/>
					</div>
				{:else if draft.rule.ends === 'after'}
					<div class="grid gap-2 p-3">
						<Label for="schedule-end-count">{m.schedule_end_count()}</Label>
						<Input
							id="schedule-end-count"
							bind:value={draft.rule.endCount}
							inputmode="numeric"
							autocomplete="off"
							class="w-20"
						/>
					</div>
				{/if}
			{/if}
		</div>

		<FormMessage {error} />
	{:else}
		<ConfirmPanel
			body={m.schedule_delete_body()}
			confirmLabel={m.schedule_delete()}
			{error}
			{busy}
			onCancel={() => go('main')}
			onConfirm={remove}
		/>
	{/if}
</form>
