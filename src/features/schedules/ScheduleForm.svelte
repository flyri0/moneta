<script lang="ts">
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import * as Alert from '$ui/alert';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import { Switch } from '$ui/switch';
	import SheetLink from '$components/SheetLink.svelte';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import HelpLink from '$components/HelpLink.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { enterAndReport } from '$client/schedules';
	import { isFarFuture, todayIso } from '$domain/month';
	import {
		dueCount,
		FREQUENCIES,
		WEEKEND_RULES,
		type Frequency,
		type WeekendRule
	} from '$domain/schedule';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { canSplit, splitRemaining, type FormContext } from '$features/transactions/form';
	import { canInstall } from '$features/transactions/installments';
	import { FORM_ERRORS } from '$features/transactions/form-errors';
	import TransactionFields from '$features/transactions/TransactionFields.svelte';
	import {
		NewCategories,
		categoryValues,
		withCategoryIds
	} from '$features/categories/new-categories';
	import {
		buildScheduleInput,
		draftRuleSummary,
		FREQUENCY_LABELS,
		installmentDate,
		installmentsLeft,
		paysInstallments,
		MANY_DUE,
		type Ends,
		type ScheduleDraft,
		type ScheduleFormError,
		type ScheduleView
	} from './form';

	/**
	 * Adds a schedule, or edits the one `editingId` names. `view` is the screen: the transaction
	 * first, the repeat rule one tap away. The draft is kept across screens. Cancel calls
	 * `onCancel` when given (back to the schedule's overview), or `onDone`.
	 */
	let {
		ctx,
		initial,
		editingId,
		view = $bindable(),
		onCancel,
		onDone
	}: {
		ctx: FormContext;
		initial: ScheduleDraft;
		editingId: string | null;
		view: ScheduleView;
		onCancel?: () => void;
		onDone: () => void;
	} = $props();

	const session = useSession();
	// The dialog re-creates this form (with {#key}) for every schedule it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state(structuredClone(initial));
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	const pending = new NewCategories();

	const ERRORS: Record<ScheduleFormError, () => string> = {
		...FORM_ERRORS,
		INTERVAL_INVALID: m.form_error_interval_invalid,
		END_DATE_INVALID: m.form_error_end_date_invalid,
		END_COUNT_INVALID: m.form_error_end_count_invalid,
		INSTALLMENT_NUMBER_INVALID: m.form_error_installment_number_invalid,
		INSTALLMENT_TOTAL_INVALID: m.form_error_installment_total_invalid,
		INSTALLMENT_DATE_PAST: m.form_error_installment_date_past
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

	/** Only a card purchase offers installments, as a new purchase does. */
	const installable = $derived(canInstall(draft.txn, ctx));
	const installing = $derived(paysInstallments(draft, ctx));
	/** On a card with billing days, installments fall on its due dates: the date isn't typed. */
	const lockedDate = $derived(installmentDate(draft, ctx, todayIso()));
	const left = $derived(installmentsLeft(draft, ctx));
	const leftText = $derived.by(() => {
		if (!left) return '';
		const count = m.schedule_installments_left({
			count: left.left,
			next: left.next,
			total: left.total
		});
		return left.sum === null
			? count
			: `${count} · ${m.schedule_installments_sum({ amount: session.format(left.sum) })}`;
	});

	/** What the repeat row says while installments are on: which one comes next, once typed. */
	const installmentsDetail = $derived(
		left ? m.schedules_installment({ n: left.next, total: left.total }) : m.schedule_installments()
	);

	/** How many transactions saving enters at once, when that many that it asks first. */
	let manyDue = $state(0);
	/** A date years ahead the user was asked about: saving it again goes ahead. */
	let farDate = $state<string | null>(null);
	const askingFar = $derived(farDate !== null && farDate === draft.txn.date);

	function save(event: SubmitEvent) {
		event.preventDefault();
		void submit(false);
	}

	async function submit(confirmed: boolean) {
		const result = buildScheduleInput(draft, ctx);
		if (!result.ok) {
			// The installment numbers are on their own screen: show the error there.
			if (
				result.error === 'INSTALLMENT_NUMBER_INVALID' ||
				result.error === 'INSTALLMENT_TOTAL_INVALID'
			)
				view = 'repeat';
			error = { message: ERRORS[result.error]() };
			return;
		}
		const input = result.input;
		// The date the form shows is the one saved, even when it was locked to a due date.
		if (lockedDate) draft.txn.date = lockedDate;
		// A year typed wrong would stretch every budget computation to it: ask once.
		if (isFarFuture(input.startDate, todayIso()) && farDate !== input.startDate) {
			farDate = input.startDate;
			return;
		}
		// A start date typed years back would enter years of transactions at once.
		const due = input.autoEnter ? dueCount(input, todayIso()) : 0;
		if (due > MANY_DUE && !confirmed) {
			manyDue = due;
			go('enter-many');
			return;
		}
		busy = true;
		error = await runAction(async () => {
			// Categories picked by a new name are created first, then used by their ids.
			const ids = await pending.resolve(session.api, categoryValues(input));
			const saved = withCategoryIds(input, ids);
			await (editingId
				? session.api.schedules.update(editingId, saved)
				: session.api.schedules.create(saved));
		});
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
</script>

<form class="grid gap-4" onsubmit={save}>
	{#if view === 'main'}
		<TransactionFields
			{ctx}
			bind:draft={draft.txn}
			dateLabel={m.schedule_next_date()}
			{lockedDate}
			{pending}
		/>

		{#if lockedDate}
			<p class="-mt-2 text-xs text-muted-foreground" data-testid="installments-due">
				{m.schedule_installments_due({ date: formatDate(lockedDate, getLocale()) })}
			</p>
		{/if}

		<nav class="-mx-2 grid gap-0.5">
			<div class="flex min-h-11 items-center justify-between gap-4 px-2 py-1">
				<div class="grid gap-0.5">
					<Label for="schedule-auto">{m.schedule_auto_enter()}</Label>
					<p class="text-xs text-muted-foreground">
						{draft.autoEnter ? m.schedule_auto_enter_hint() : m.schedule_manual_hint()}
					</p>
				</div>
				<Switch id="schedule-auto" bind:checked={draft.autoEnter} />
			</div>
			<!-- On a card purchase, the same screen sets installments: one row for both. -->
			<SheetLink
				icon={installing ? CreditCardIcon : RepeatIcon}
				label={m.schedule_frequency()}
				detail={installing ? installmentsDetail : draftRuleSummary(draft.rule)}
				onclick={() => go('repeat')}
			/>
		</nav>

		{#if askingFar}
			<Alert.Root data-testid="far-future">
				<Alert.Description>
					{m.date_far_future({ date: formatDate(draft.txn.date, getLocale()) })}
				</Alert.Description>
			</Alert.Root>
		{/if}

		<FormMessage {error} />

		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" onclick={onCancel ?? onDone}>{m.cancel()}</Button>
			<Button type="submit" disabled={busy || blocked}>
				{askingFar ? m.save_anyway() : m.save()}
			</Button>
		</div>
	{:else if view === 'repeat'}
		{#if installable}
			<div class="grid divide-y rounded-lg border">
				<div class="flex items-center justify-between gap-4 p-3">
					<div class="grid gap-1">
						<Label for="schedule-installments">{m.schedule_installments()}</Label>
						<p class="text-xs text-muted-foreground">{m.schedule_installments_hint()}</p>
					</div>
					<Switch id="schedule-installments" bind:checked={draft.installments.on} />
				</div>
				{#if draft.installments.on}
					<div class="grid gap-2 p-3">
						<div class="flex flex-wrap items-center gap-2">
							<Label for="schedule-installment-next">{m.schedule_installment_next()}</Label>
							<Input
								id="schedule-installment-next"
								class="w-16"
								bind:value={draft.installments.next}
								inputmode="numeric"
								autocomplete="off"
								placeholder="4"
							/>
							<span class="text-sm text-muted-foreground">{m.schedule_installment_of()}</span>
							<Input
								id="schedule-installment-total"
								class="w-16"
								bind:value={draft.installments.total}
								inputmode="numeric"
								autocomplete="off"
								placeholder="12"
								aria-label={m.schedule_installment_total()}
							/>
						</div>
						{#if leftText}
							<p class="text-sm text-muted-foreground tabular-nums" data-testid="installments-left">
								{leftText}
							</p>
						{/if}
					</div>
				{/if}
			</div>
			<HelpLink topic="installmentsUnderWay" text class="justify-self-start" />
		{/if}

		<!-- Installments are always monthly, until the last one: no repeat rule to set. -->
		{#if !installing}
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
		{/if}

		<FormMessage {error} />
	{:else if view === 'enter-many'}
		<ConfirmPanel
			body={m.schedule_enter_many_body({ count: manyDue })}
			confirmLabel={m.schedule_enter_many_confirm({ count: manyDue })}
			destructive={false}
			{error}
			{busy}
			onCancel={() => go('main')}
			onConfirm={() => void submit(true)}
		/>
	{/if}
</form>
