import type { ScheduleInput, ScheduleRow } from '$db/repos/schedules';
import { nextDueDate } from '$domain/card-bill';
import { MAX_INSTALLMENTS } from '$domain/installments';
import { isDate, todayIso } from '$domain/month';
import { parseAmount } from '$domain/money';
import {
	occurrenceDate,
	resumeDate,
	type Frequency,
	type Rule,
	type WeekendRule
} from '$domain/schedule';
import { m } from '$i18n/paraglide/messages';
import { canInstall } from '$features/transactions/installments';
import {
	buildTransactionInput,
	draftFromTransaction,
	newDraft,
	type FormContext,
	type FormError,
	type TransactionDraft
} from '$features/transactions/form';

export type Ends = 'never' | 'on' | 'after';

/** The schedule sheet's screens. */
export type ScheduleView = 'overview' | 'enter' | 'main' | 'repeat' | 'delete' | 'enter-many';

/** How many due occurrences an automatic schedule may enter at once before saving asks first. */
export const MANY_DUE = 20;

/** The rule fields as the form edits them. Numbers are text, as typed. */
export interface RuleDraft {
	frequency: Frequency;
	interval: string;
	weekend: WeekendRule;
	ends: Ends;
	endDate: string;
	endCount: string;
}

/** A purchase in installments, as the form edits it. Numbers are text, as typed. */
export interface InstallmentsDraft {
	/** Whether it pays a purchase in installments, numbering what it enters. */
	on: boolean;
	/** The number of the installment on the next date. */
	next: string;
	total: string;
	/**
	 * The account and next date of a schedule that already paid installments when the form opened:
	 * editing it on that account keeps its date, even when it isn't the card's next due date.
	 */
	kept: { accountId: string; date: string } | null;
}

/** What the schedule form edits. `txn.date` is the next date; `txn.cleared` is not used. */
export interface ScheduleDraft {
	txn: TransactionDraft;
	rule: RuleDraft;
	autoEnter: boolean;
	installments: InstallmentsDraft;
}

/** An occurrence the transaction dialog enters: it starts from the template, on `date`. */
export interface OccurrenceToEnter {
	schedule: ScheduleRow;
	index: number;
	date: string;
}

export type ScheduleFormError =
	| FormError
	| 'INTERVAL_INVALID'
	| 'END_DATE_INVALID'
	| 'END_COUNT_INVALID'
	| 'INSTALLMENT_NUMBER_INVALID'
	| 'INSTALLMENT_TOTAL_INVALID'
	| 'INSTALLMENT_DATE_PAST';

export type ScheduleBuildResult =
	{ ok: true; input: ScheduleInput } | { ok: false; error: ScheduleFormError };

/**
 * A new schedule's draft. With `installments`, it starts as a purchase in installments already
 * under way, entered by itself like the installments of a new purchase.
 */
export function newScheduleDraft(
	accountId: string,
	date: string,
	opts: { installments?: boolean } = {}
): ScheduleDraft {
	const installments = opts.installments ?? false;
	return {
		txn: newDraft(accountId, date),
		rule: {
			frequency: 'monthly',
			interval: '1',
			weekend: 'keep',
			ends: 'never',
			endDate: '',
			endCount: ''
		},
		autoEnter: installments,
		installments: { on: installments, next: '', total: '', kept: null }
	};
}

/**
 * A draft that edits `schedule` from its next occurrence on: the date it is scheduled on, before a
 * weekend move (for an ended schedule, the date after its last one). Saving that date unchanged
 * keeps the schedule's place; an end count becomes the occurrences left.
 */
export function draftFromSchedule(schedule: ScheduleRow, ctx: FormContext): ScheduleDraft {
	const date = resumeDate(schedule, schedule.nextIndex) ?? schedule.startDate;
	const left = schedule.endCount === null ? null : schedule.endCount - schedule.nextIndex;
	return {
		txn: draftFromTransaction({ ...schedule, date, cleared: false }, ctx),
		rule: {
			frequency: schedule.frequency,
			interval: String(schedule.interval),
			weekend: schedule.weekend,
			ends: schedule.endDate !== null ? 'on' : left !== null ? 'after' : 'never',
			endDate: schedule.endDate ?? '',
			endCount: left === null ? '' : String(left)
		},
		autoEnter: schedule.autoEnter,
		installments:
			schedule.installmentStart === null || schedule.endCount === null
				? { on: false, next: '', total: '', kept: null }
				: {
						on: true,
						next: String(schedule.installmentStart + schedule.nextIndex),
						total: String(schedule.installmentStart + schedule.endCount - 1),
						kept: { accountId: schedule.accountId, date }
					}
	};
}

function wholeNumber(text: string): number | null {
	const trimmed = text.trim();
	if (!/^\d{1,4}$/.test(trimmed)) return null;
	const value = Number(trimmed);
	return value >= 1 ? value : null;
}

/**
 * Whether the draft pays a purchase in installments: switched on, and a card purchase (an outflow,
 * not a transfer or split), as a new purchase in installments must be. Otherwise the switch is
 * hidden and ignored.
 */
export function paysInstallments(draft: ScheduleDraft, ctx: FormContext): boolean {
	return draft.installments.on && canInstall(draft.txn, ctx);
}

/** An installment number from 1 to 99, as typed; null otherwise. */
function installmentNumber(text: string): number | null {
	const trimmed = text.trim();
	if (!/^\d{1,2}$/.test(trimmed)) return null;
	const value = Number(trimmed);
	return value >= 1 && value <= MAX_INSTALLMENTS ? value : null;
}

/**
 * The next date of a purchase in installments on a card with billing days, which the form doesn't
 * let the user type: installments fall on their bill's due date, as a new purchase's do. That is
 * the next due date from `today`, or the schedule's own next date when editing one that already
 * paid installments on this account. Null when the date is typed.
 */
export function installmentDate(
	draft: ScheduleDraft,
	ctx: FormContext,
	today: string
): string | null {
	if (!paysInstallments(draft, ctx)) return null;
	const account = ctx.accounts.find((a) => a.id === draft.txn.accountId);
	if (account?.closingDay == null || account.dueDay == null) return null;
	const { kept } = draft.installments;
	if (kept && kept.accountId === account.id) return kept.date;
	return nextDueDate({ closingDay: account.closingDay, dueDay: account.dueDay }, today);
}

export interface InstallmentsLeft {
	/** How many installments are left, the next one included. */
	left: number;
	next: number;
	total: number;
	/** What they come to, in minor units; null while the amount isn't valid. */
	sum: number | null;
}

/** The installments left, for the form to show; null while the numbers aren't valid. */
export function installmentsLeft(draft: ScheduleDraft, ctx: FormContext): InstallmentsLeft | null {
	if (!paysInstallments(draft, ctx)) return null;
	const next = installmentNumber(draft.installments.next);
	const total = installmentNumber(draft.installments.total);
	if (next === null || total === null || next > total) return null;
	const left = total - next + 1;
	const each = parseAmount(draft.txn.amount, ctx.money);
	const sum = each === null ? null : Math.abs(each) * left;
	return { left, next, total, sum: sum !== null && Number.isSafeInteger(sum) ? sum : null };
}

/** A schedule's installments left, from its next one; null when it pays none or none are left. */
export function scheduleInstallments(s: ScheduleRow): InstallmentsLeft | null {
	if (s.installmentStart === null || s.endCount === null || s.nextDate === null) return null;
	const left = s.endCount - s.nextIndex;
	if (left < 1) return null;
	const sum = Math.abs(s.amount) * left;
	return {
		next: s.installmentStart + s.nextIndex,
		total: s.installmentStart + s.endCount - 1,
		left,
		sum: Number.isSafeInteger(sum) ? sum : null
	};
}

export interface NextOccurrence {
	index: number;
	date: string;
	/** Its installment number, when the schedule pays a purchase in installments. */
	installment: number | null;
}

/** Up to `count` of a schedule's occurrences, from the next one on. */
export function nextOccurrences(s: ScheduleRow, count: number): NextOccurrence[] {
	const out: NextOccurrence[] = [];
	for (let n = s.nextIndex; out.length < count; n++) {
		const date = occurrenceDate(s, n);
		if (date === null) break;
		out.push({
			index: n,
			date,
			installment: s.installmentStart === null ? null : s.installmentStart + n
		});
	}
	return out;
}

/**
 * Validates a draft and turns it into the repo's ScheduleInput. A purchase in installments is
 * monthly and ends after its last installment, whatever the repeat screen holds.
 */
export function buildScheduleInput(
	draft: ScheduleDraft,
	ctx: FormContext,
	today = todayIso()
): ScheduleBuildResult {
	const locked = installmentDate(draft, ctx, today);
	const built = buildTransactionInput(locked ? { ...draft.txn, date: locked } : draft.txn, ctx);
	if (!built.ok) return built;
	const t = built.input;
	const template = {
		accountId: t.accountId,
		amount: t.amount,
		payeeName: t.payeeName ?? null,
		categoryId: t.categoryId ?? null,
		memo: t.memo ?? '',
		splits: t.splits,
		transferAccountId: t.transferAccountId ?? null,
		flag: t.flag ?? null,
		startDate: t.date,
		autoEnter: draft.autoEnter
	};
	if (paysInstallments(draft, ctx)) {
		const next = installmentNumber(draft.installments.next);
		if (next === null) return { ok: false, error: 'INSTALLMENT_NUMBER_INVALID' };
		const total = installmentNumber(draft.installments.total);
		if (total === null || total < next) return { ok: false, error: 'INSTALLMENT_TOTAL_INVALID' };
		if (t.amount === 0) return { ok: false, error: 'INSTALLMENTS_INVALID' };
		// The next installment isn't paid yet: a past date would enter paid ones. A schedule being
		// edited keeps its own date, which may be due.
		const { kept } = draft.installments;
		const ownDate = kept?.accountId === t.accountId && kept.date === t.date;
		if (t.date < today && !ownDate) return { ok: false, error: 'INSTALLMENT_DATE_PAST' };
		return {
			ok: true,
			input: {
				...template,
				frequency: 'monthly',
				interval: 1,
				endDate: null,
				endCount: total - next + 1,
				weekend: 'keep',
				installmentStart: next
			}
		};
	}
	const { rule } = draft;
	const once = rule.frequency === 'once';
	const interval = once ? 1 : wholeNumber(rule.interval);
	if (interval === null) return { ok: false, error: 'INTERVAL_INVALID' };
	let endDate: string | null = null;
	let endCount: number | null = null;
	if (!once && rule.ends === 'on') {
		if (!isDate(rule.endDate) || rule.endDate < t.date)
			return { ok: false, error: 'END_DATE_INVALID' };
		endDate = rule.endDate;
	}
	if (!once && rule.ends === 'after') {
		endCount = wholeNumber(rule.endCount);
		if (endCount === null) return { ok: false, error: 'END_COUNT_INVALID' };
	}
	return {
		ok: true,
		input: {
			...template,
			frequency: rule.frequency,
			interval,
			endDate,
			endCount,
			weekend: rule.frequency === 'daily' ? 'keep' : rule.weekend,
			installmentStart: null
		}
	};
}

const EVERY: Record<Exclude<Frequency, 'once'>, () => string> = {
	daily: m.schedule_every_day,
	weekly: m.schedule_every_week,
	monthly: m.schedule_every_month,
	yearly: m.schedule_every_year
};

const EVERY_N: Record<Exclude<Frequency, 'once'>, (inputs: { count: number }) => string> = {
	daily: m.schedule_every_n_days,
	weekly: m.schedule_every_n_weeks,
	monthly: m.schedule_every_n_months,
	yearly: m.schedule_every_n_years
};

/** "Every 2 weeks", in the UI language. */
export function ruleSummary(rule: Pick<Rule, 'frequency' | 'interval'>): string {
	if (rule.frequency === 'once') return m.schedule_once();
	return rule.interval === 1
		? EVERY[rule.frequency]()
		: EVERY_N[rule.frequency]({ count: rule.interval });
}

/** Each frequency's name, as the Repeats picker lists it. */
export const FREQUENCY_LABELS: Record<Frequency, () => string> = {
	once: m.schedule_once,
	daily: m.schedule_frequency_daily,
	weekly: m.schedule_frequency_weekly,
	monthly: m.schedule_frequency_monthly,
	yearly: m.schedule_frequency_yearly
};

/** The rule being edited, as `ruleSummary` says it; just "Weekly" while the interval is invalid. */
export function draftRuleSummary(rule: RuleDraft): string {
	if (rule.frequency === 'once') return m.schedule_once();
	const interval = wholeNumber(rule.interval);
	return interval === null
		? FREQUENCY_LABELS[rule.frequency]()
		: ruleSummary({ frequency: rule.frequency, interval });
}
