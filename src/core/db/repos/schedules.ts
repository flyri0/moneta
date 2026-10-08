import { uuidv7 } from 'uuidv7';
import { installmentDueDate, isDueDay } from '$domain/card-bill';
import { DomainError } from '$domain/errors';
import type { FlagColor } from '$domain/flag';
import { groupBy } from '$domain/group-by';
import {
	installmentMemo,
	MAX_INSTALLMENTS,
	occurrenceMemo,
	splitInstallments
} from '$domain/installments';
import { MAX_DATE } from '$domain/month';
import {
	occurrenceDate,
	occurrencesBetween,
	resumeDate,
	validateRule,
	type Rule
} from '$domain/schedule';
import { all, nowIso, one, run, tx, type Db } from '../connection';
import { getOrCreatePayee } from './payees';
import { createTransaction, validateTransaction, type TransactionInput } from './transactions';

/** A schedule as the form writes it: a transaction without its date, and the rule that dates it. */
export interface ScheduleInput extends Omit<TransactionInput, 'date' | 'cleared'>, Rule {
	autoEnter: boolean;
	/**
	 * The installment number of the occurrence on `startDate`, when it pays a purchase in
	 * installments and numbers what it enters ("4/12"). Needs `endCount`, and the rule a purchase
	 * in installments has (see `validateInstallments`).
	 */
	installmentStart?: number | null;
}

export interface ScheduleSplitRow {
	id: string;
	categoryId: string;
	categoryName: string;
	amount: number;
	memo: string;
}

/**
 * due: a manual schedule whose next occurrence is today or earlier. paused: its account or its
 * transfer account is closed. ended: it has no occurrence left.
 */
export type ScheduleStatus = 'due' | 'active' | 'paused' | 'ended';

export interface ScheduleRow extends Rule {
	id: string;
	accountId: string;
	accountName: string;
	amount: number;
	payeeId: string | null;
	payeeName: string | null;
	categoryId: string | null;
	categoryName: string | null;
	transferAccountId: string | null;
	transferAccountName: string | null;
	memo: string;
	/** Passed on to the transactions it enters. */
	flag: FlagColor | null;
	isSplit: boolean;
	splits: ScheduleSplitRow[];
	autoEnter: boolean;
	/** How many occurrences were entered or skipped. */
	nextIndex: number;
	/** The installment number of occurrence 0, when the schedule pays a purchase in installments. */
	installmentStart: number | null;
	nextDate: string | null;
	status: ScheduleStatus;
}

/** One occurrence, seen from `accountId`: a transfer shows in both of its accounts. */
export interface UpcomingOccurrence {
	scheduleId: string;
	index: number;
	date: string;
	accountId: string;
	amount: number;
	payeeName: string | null;
	categoryName: string | null;
	isSplit: boolean;
	transferAccountId: string | null;
	transferAccountName: string | null;
	memo: string;
	/** The schedule's flag, on its own account's side only. */
	flag: FlagColor | null;
	autoEnter: boolean;
	/** The schedule's next occurrence: the only one that can be entered or skipped. */
	isNext: boolean;
	/** A manual occurrence dated today or earlier. */
	due: boolean;
}

export interface UpcomingQuery {
	/** Without it, every schedule shows once, from its own account. */
	accountId?: string;
	today: string;
	/** The last date to list. */
	to: string;
}

type Raw = Omit<ScheduleRow, 'isSplit' | 'autoEnter' | 'splits' | 'nextDate' | 'status'> & {
	isSplit: number;
	autoEnter: number;
	paused: number;
};

const SELECT_SQL = `SELECT s.id, s.account_id AS accountId, a.name AS accountName, s.amount,
	s.payee_id AS payeeId, p.name AS payeeName, s.category_id AS categoryId, c.name AS categoryName,
	s.transfer_account_id AS transferAccountId, ta.name AS transferAccountName, s.memo,
	s.flag, s.is_split AS isSplit, s.start_date AS startDate, s.frequency, s.interval,
	s.end_date AS endDate, s.end_count AS endCount, s.weekend, s.auto_enter AS autoEnter,
	s.next_index AS nextIndex, s.installment_start AS installmentStart,
	(a.closed = 1 OR COALESCE(ta.closed, 0) = 1) AS paused
	FROM schedules s
	JOIN accounts a ON a.id = s.account_id
	LEFT JOIN payees p ON p.id = s.payee_id
	LEFT JOIN categories c ON c.id = s.category_id
	LEFT JOIN accounts ta ON ta.id = s.transfer_account_id`;

function statusOf(
	paused: boolean,
	autoEnter: boolean,
	nextDate: string | null,
	today: string
): ScheduleStatus {
	if (paused) return 'paused';
	if (nextDate === null) return 'ended';
	return !autoEnter && nextDate <= today ? 'due' : 'active';
}

function toRows(db: Db, raws: Raw[], today: string): ScheduleRow[] {
	const splitIds = raws.filter((r) => r.isSplit === 1).map((r) => r.id);
	const splits =
		splitIds.length === 0
			? []
			: all<ScheduleSplitRow & { scheduleId: string }>(
					db,
					`SELECT s.id, s.schedule_id AS scheduleId, s.category_id AS categoryId,
						c.name AS categoryName, s.amount, s.memo
					 FROM schedule_splits s JOIN categories c ON c.id = s.category_id
					 WHERE s.schedule_id IN (SELECT value FROM json_each(?))
					 ORDER BY s.rowid`,
					[JSON.stringify(splitIds)]
				);
	const bySchedule = groupBy(splits, (s) => s.scheduleId);
	return raws.map(({ paused, isSplit, autoEnter, ...rest }) => {
		const nextDate = occurrenceDate(rest, rest.nextIndex);
		return {
			...rest,
			isSplit: isSplit === 1,
			autoEnter: autoEnter === 1,
			splits: (bySchedule.get(rest.id) ?? []).map((s) => ({
				id: s.id,
				categoryId: s.categoryId,
				categoryName: s.categoryName,
				amount: s.amount,
				memo: s.memo
			})),
			nextDate,
			status: statusOf(paused === 1, autoEnter === 1, nextDate, today)
		};
	});
}

/** Every schedule, soonest next date first; ended ones last. */
export function listSchedules(db: Db, today: string): ScheduleRow[] {
	const key = (s: ScheduleRow) => s.nextDate ?? MAX_DATE;
	return toRows(db, all<Raw>(db, SELECT_SQL), today).sort(
		(a, b) => key(a).localeCompare(key(b)) || a.id.localeCompare(b.id)
	);
}

export function getSchedule(db: Db, id: string, today: string): ScheduleRow {
	const raw = one<Raw>(db, `${SELECT_SQL} WHERE s.id = ?`, [id]);
	if (!raw) throw new DomainError('NOT_FOUND', `Schedule ${id} not found`);
	return toRows(db, [raw], today)[0];
}

type Template = Pick<
	ScheduleInput,
	| 'accountId'
	| 'amount'
	| 'payeeName'
	| 'categoryId'
	| 'memo'
	| 'splits'
	| 'transferAccountId'
	| 'flag'
>;

/** The transaction a template makes on `date`. */
function transactionAt(t: Template, date: string, memo = t.memo): TransactionInput {
	return {
		accountId: t.accountId,
		date,
		amount: t.amount,
		payeeName: t.payeeName,
		categoryId: t.categoryId,
		memo,
		splits: t.splits,
		transferAccountId: t.transferAccountId,
		flag: t.flag
	};
}

function insert(
	db: Db,
	id: string,
	input: ScheduleInput,
	createdAt: string,
	nextIndex = 0,
	installmentStart: number | null = null
): void {
	validateRule(input);
	validateTransaction(db, transactionAt(input, input.startDate));
	if (installmentStart !== null) validateInstallments(input, installmentStart);
	const splits = input.splits ?? [];
	run(
		db,
		`INSERT INTO schedules (id, account_id, amount, payee_id, category_id, transfer_account_id,
			memo, is_split, start_date, frequency, interval, end_date, end_count, weekend, auto_enter,
			next_index, installment_start, created_at, flag)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.accountId,
			input.amount,
			input.transferAccountId ? null : getOrCreatePayee(db, input.payeeName),
			input.categoryId ?? null,
			input.transferAccountId ?? null,
			input.memo ?? '',
			splits.length > 0 ? 1 : 0,
			input.startDate,
			input.frequency,
			input.interval,
			input.endDate,
			input.endCount,
			input.weekend,
			input.autoEnter ? 1 : 0,
			nextIndex,
			installmentStart,
			createdAt,
			input.flag ?? null
		]
	);
	for (const s of splits) {
		run(
			db,
			'INSERT INTO schedule_splits (id, schedule_id, category_id, amount, memo) VALUES (?, ?, ?, ?, ?)',
			[uuidv7(), id, s.categoryId, s.amount, s.memo ?? '']
		);
	}
}

/**
 * A schedule that numbers installments follows the rule of a purchase in installments: monthly,
 * keeping its dates, and ending after the last one, at most the 99th. `start` is the number of
 * occurrence 0.
 */
function validateInstallments(input: ScheduleInput, start: number): void {
	if (!Number.isInteger(start) || start < 1)
		throw new DomainError('INVALID_INPUT', 'Installment numbers start at 1');
	if (input.endCount === null)
		throw new DomainError('INVALID_INPUT', 'Installments end after a count');
	if (start + input.endCount - 1 > MAX_INSTALLMENTS)
		throw new DomainError('INVALID_INPUT', 'Installments must be 99 at most');
	if (
		input.frequency !== 'monthly' ||
		input.interval !== 1 ||
		input.weekend !== 'keep' ||
		input.endDate !== null
	)
		throw new DomainError('INVALID_INPUT', 'Installments are monthly');
}

/**
 * Throws INVALID_INPUT unless the input is a card purchase (an outflow, not a transfer or split),
 * as a new purchase in installments must be. With `checkDate`, its date must also be the card's
 * due day when it has billing days: installments are entered on their bill's due date.
 */
function checkInstallmentPurchase(db: Db, input: ScheduleInput, checkDate: boolean): void {
	const account = one<{ type: string; closingDay: number | null; dueDay: number | null }>(
		db,
		'SELECT type, closing_day AS closingDay, due_day AS dueDay FROM accounts WHERE id = ?',
		[input.accountId]
	);
	if (account?.type !== 'credit_card')
		throw new DomainError('INVALID_INPUT', 'Only card purchases are paid in installments');
	if (input.transferAccountId || (input.splits?.length ?? 0) > 0 || input.amount >= 0)
		throw new DomainError('INVALID_INPUT', 'Only purchases are paid in installments');
	if (!checkDate || account.closingDay === null || account.dueDay === null) return;
	if (!isDueDay({ closingDay: account.closingDay, dueDay: account.dueDay }, input.startDate))
		throw new DomainError('INVALID_INPUT', 'Installments fall on the card’s due day');
}

type Stored = Rule & { nextIndex: number; installmentStart: number | null; createdAt: string };

function requireSchedule(db: Db, id: string): Stored {
	const row = one<Stored>(
		db,
		`SELECT start_date AS startDate, frequency, interval, end_date AS endDate,
			end_count AS endCount, weekend, next_index AS nextIndex,
			installment_start AS installmentStart, created_at AS createdAt
		 FROM schedules WHERE id = ?`,
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Schedule ${id} not found`);
	return row;
}

export function createSchedule(db: Db, input: ScheduleInput): string {
	return tx(db, () => {
		const id = uuidv7();
		const start = input.installmentStart ?? null;
		if (start !== null) checkInstallmentPurchase(db, input, true);
		insert(db, id, input, nowIso(), 0, start);
		return id;
	});
}

/**
 * Replaces a schedule's template and rule, keeping its id. `input.startDate` is the next date and
 * `endCount` counts the occurrences from there. When the next date is where the schedule picks up
 * anyway (see `resumeDate`) and the cadence is the same, it keeps its place: a month-end day stays
 * put, and occurrences already entered or skipped never come back. Otherwise the rule restarts
 * at the new date. `input.installmentStart` is the installment number of the next date; a number
 * lower than the occurrences already passed also restarts the rule, and a restarted installment
 * schedule falls on the card's due day like a new one.
 */
export function updateSchedule(db: Db, id: string, input: ScheduleInput): void {
	tx(db, () => {
		const stored = requireSchedule(db, id);
		const next = input.installmentStart ?? null;
		const keep =
			input.frequency === stored.frequency &&
			input.interval === stored.interval &&
			input.startDate === resumeDate(stored, stored.nextIndex) &&
			(next === null || next - stored.nextIndex >= 1);
		// The schedule's own dates stand, even from before the card had billing days, or a due day
		// past the end of the month its first installment fell in.
		const ownDate = input.startDate === resumeDate(stored, stored.nextIndex);
		if (next !== null) checkInstallmentPurchase(db, input, !ownDate);
		run(db, 'DELETE FROM schedules WHERE id = ?', [id]);
		if (!keep) {
			insert(db, id, input, stored.createdAt, 0, next);
			return;
		}
		const endCount = input.endCount === null ? null : input.endCount + stored.nextIndex;
		insert(
			db,
			id,
			{ ...input, startDate: stored.startDate, endCount },
			stored.createdAt,
			stored.nextIndex,
			next === null ? null : next - stored.nextIndex
		);
	});
}

/**
 * Records a card purchase of `count` installments, one a month from its date: enters the first,
 * which takes the cents left over, and schedules the rest to be entered on their dates, each
 * memo numbered ("TV 2/12"). A card with billing days puts every installment, the first too, on
 * its bill's due date instead. Returns the first installment's transaction id.
 */
export function createInstallments(db: Db, input: TransactionInput, count: number): string {
	return tx(db, () => {
		if (!Number.isInteger(count) || count < 2 || count > MAX_INSTALLMENTS)
			throw new DomainError('INVALID_INPUT', 'Installments must be 2 to 99');
		const account = one<{ type: string; closingDay: number | null; dueDay: number | null }>(
			db,
			'SELECT type, closing_day AS closingDay, due_day AS dueDay FROM accounts WHERE id = ?',
			[input.accountId]
		);
		if (account?.type !== 'credit_card')
			throw new DomainError('INVALID_INPUT', 'Only card purchases are paid in installments');
		if (input.transferAccountId || (input.splits?.length ?? 0) > 0)
			throw new DomainError('INVALID_INPUT', 'Transfers and splits are not paid in installments');
		if (!Number.isInteger(input.amount) || -input.amount < count)
			throw new DomainError('INVALID_INPUT', 'Installments need a purchase of a cent each');
		const { first, rest } = splitInstallments(-input.amount, count);
		const memo = input.memo ?? '';
		// The schedule steps a month at a time from the first due date. A due day past the end of
		// that month (the 31st in September) stays on the shorter day, still in the right month.
		const date =
			account.closingDay !== null && account.dueDay !== null
				? installmentDueDate(
						{ closingDay: account.closingDay, dueDay: account.dueDay },
						input.date,
						0
					)
				: input.date;
		const transactionId = createTransaction(db, {
			...input,
			date,
			amount: -first,
			memo: installmentMemo(memo, 1, count)
		});
		const schedule: ScheduleInput = {
			accountId: input.accountId,
			amount: -rest,
			payeeName: input.payeeName ?? null,
			categoryId: input.categoryId ?? null,
			memo,
			flag: input.flag ?? null,
			startDate: date,
			frequency: 'monthly',
			interval: 1,
			endDate: null,
			endCount: count,
			weekend: 'keep',
			autoEnter: true
		};
		insert(db, uuidv7(), schedule, nowIso(), 1, 1);
		return transactionId;
	});
}

export function deleteSchedule(db: Db, id: string): void {
	tx(db, () => {
		requireSchedule(db, id);
		run(db, 'DELETE FROM schedules WHERE id = ?', [id]);
	});
}

/** Checks that `index` is the schedule's next occurrence and that the schedule has it. */
function checkNext(db: Db, id: string, index: number): void {
	const row = one<Rule & { nextIndex: number }>(
		db,
		`SELECT start_date AS startDate, frequency, interval, end_date AS endDate,
			end_count AS endCount, weekend, next_index AS nextIndex
		 FROM schedules WHERE id = ?`,
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Schedule ${id} not found`);
	if (index !== row.nextIndex) throw new DomainError('SCHEDULE_STALE');
	if (occurrenceDate(row, index) === null) throw new DomainError('SCHEDULE_ENDED');
}

function advance(db: Db, id: string, by: number): void {
	run(db, 'UPDATE schedules SET next_index = next_index + ? WHERE id = ?', [by, id]);
}

/**
 * Enters occurrence `index` as `input` (the dialog may have changed its amount or date) and moves
 * the schedule on. Returns the new transaction's id.
 */
export function enterOccurrence(
	db: Db,
	id: string,
	index: number,
	input: TransactionInput
): string {
	return tx(db, () => {
		checkNext(db, id, index);
		const transactionId = createTransaction(db, input);
		advance(db, id, 1);
		return transactionId;
	});
}

export function skipOccurrence(db: Db, id: string, index: number): void {
	tx(db, () => {
		checkNext(db, id, index);
		advance(db, id, 1);
	});
}

/**
 * Enters every occurrence up to `today` of the automatic schedules whose accounts are open, each
 * on its own date. Returns how many transactions it entered.
 */
export function enterDueOccurrences(db: Db, today: string): number {
	return tx(db, () => {
		let count = 0;
		for (const s of listSchedules(db, today)) {
			if (!s.autoEnter || s.status !== 'active') continue;
			const due = occurrencesBetween(s, s.nextIndex, today);
			for (const o of due)
				createTransaction(db, transactionAt(s, o.date, occurrenceMemo(s, o.index)));
			if (due.length > 0) advance(db, s.id, due.length);
			count += due.length;
		}
		return count;
	});
}

/** Occurrences up to `query.to` of the schedules that aren't paused or ended, oldest first. */
export function upcomingOccurrences(db: Db, query: UpcomingQuery): UpcomingOccurrence[] {
	const out: UpcomingOccurrence[] = [];
	for (const s of listSchedules(db, query.today)) {
		if (s.status === 'paused' || s.status === 'ended') continue;
		const own = !query.accountId || query.accountId === s.accountId;
		const mirrored = !!query.accountId && query.accountId === s.transferAccountId;
		if (!own && !mirrored) continue;
		for (const o of occurrencesBetween(s, s.nextIndex, query.to)) {
			const base = {
				scheduleId: s.id,
				index: o.index,
				date: o.date,
				payeeName: s.payeeName,
				isSplit: s.isSplit,
				memo: occurrenceMemo(s, o.index),
				autoEnter: s.autoEnter,
				isNext: o.index === s.nextIndex,
				due: !s.autoEnter && o.date <= query.today
			};
			out.push(
				own
					? {
							...base,
							accountId: s.accountId,
							amount: s.amount,
							categoryName: s.categoryName,
							transferAccountId: s.transferAccountId,
							transferAccountName: s.transferAccountName,
							flag: s.flag
						}
					: {
							...base,
							accountId: s.transferAccountId!,
							amount: -s.amount,
							categoryName: null,
							transferAccountId: s.accountId,
							transferAccountName: s.accountName,
							flag: null
						}
			);
		}
	}
	return out.sort(
		(a, b) =>
			a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId) || a.index - b.index
	);
}
