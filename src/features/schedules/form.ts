import type { ScheduleInput, ScheduleRow } from '$db/repos/schedules';
import { isDate } from '$domain/month';
import { resumeDate, type Frequency, type Rule, type WeekendRule } from '$domain/schedule';
import { m } from '$i18n/paraglide/messages';
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
export type ScheduleView = 'main' | 'repeat' | 'delete';

/** The rule fields as the form edits them. Numbers are text, as typed. */
export interface RuleDraft {
	frequency: Frequency;
	interval: string;
	weekend: WeekendRule;
	ends: Ends;
	endDate: string;
	endCount: string;
}

/** What the schedule form edits. `txn.date` is the next date; `txn.cleared` is not used. */
export interface ScheduleDraft {
	txn: TransactionDraft;
	rule: RuleDraft;
	autoEnter: boolean;
}

/** An occurrence the transaction dialog enters: it starts from the template, on `date`. */
export interface OccurrenceToEnter {
	schedule: ScheduleRow;
	index: number;
	date: string;
}

export type ScheduleFormError =
	FormError | 'INTERVAL_INVALID' | 'END_DATE_INVALID' | 'END_COUNT_INVALID';

export type ScheduleBuildResult =
	{ ok: true; input: ScheduleInput } | { ok: false; error: ScheduleFormError };

export function newScheduleDraft(accountId: string, date: string): ScheduleDraft {
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
		autoEnter: false
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
		autoEnter: schedule.autoEnter
	};
}

function wholeNumber(text: string): number | null {
	const trimmed = text.trim();
	if (!/^\d{1,4}$/.test(trimmed)) return null;
	const value = Number(trimmed);
	return value >= 1 ? value : null;
}

/** Validates a draft and turns it into the repo's ScheduleInput. */
export function buildScheduleInput(draft: ScheduleDraft, ctx: FormContext): ScheduleBuildResult {
	const built = buildTransactionInput(draft.txn, ctx);
	if (!built.ok) return built;
	const t = built.input;
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
			accountId: t.accountId,
			amount: t.amount,
			payeeName: t.payeeName ?? null,
			categoryId: t.categoryId ?? null,
			memo: t.memo ?? '',
			splits: t.splits,
			transferAccountId: t.transferAccountId ?? null,
			startDate: t.date,
			frequency: rule.frequency,
			interval,
			endDate,
			endCount,
			weekend: rule.frequency === 'daily' ? 'keep' : rule.weekend,
			autoEnter: draft.autoEnter
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
