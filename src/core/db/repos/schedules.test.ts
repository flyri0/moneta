import { describe, it, expect, beforeEach } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, type Db } from '../connection';
import { closeAccount, createAccount, deleteAccount, getAccount } from './accounts';
import { categoryUsage, deleteCategory } from './categories';
import {
	deletePayee,
	deleteUnusedPayees,
	getOrCreatePayee,
	listPayees,
	mergePayee
} from './payees';
import { listTransactions } from './transactions';
import {
	createSchedule,
	deleteSchedule,
	enterDueOccurrences,
	enterOccurrence,
	getSchedule,
	listSchedules,
	skipOccurrence,
	updateSchedule,
	upcomingOccurrences,
	type ScheduleInput
} from './schedules';

const code = (c: string) => expect.objectContaining({ code: c });
const T = '2026-09-24';

let db: Db;
let bank: string;
let savings: string;
let broker: string;
let rent: string;
let food: string;
let fun: string;

beforeEach(async () => {
	db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	savings = createAccount(db, { ...base, name: 'Savings', type: 'savings' });
	broker = createAccount(db, { ...base, name: 'Broker', type: 'investment', onBudget: false });
	rent = categoryId(db, 'Rent');
	food = categoryId(db, 'Food');
	fun = categoryId(db, 'Fun');
});

/** Rent of 1,500.00 from Bank on the 5th of every month, entered by hand. */
function rentInput(over: Partial<ScheduleInput> = {}): ScheduleInput {
	return {
		accountId: bank,
		amount: -150000,
		payeeName: 'Landlord',
		categoryId: rent,
		memo: 'rent',
		startDate: '2026-10-05',
		frequency: 'monthly',
		interval: 1,
		endDate: null,
		endCount: null,
		weekend: 'keep',
		autoEnter: false,
		...over
	};
}

/** A transfer of 300.00 from Bank to Savings. */
function transferInput(over: Partial<ScheduleInput> = {}): ScheduleInput {
	return rentInput({
		payeeName: null,
		categoryId: null,
		transferAccountId: savings,
		amount: -30000,
		...over
	});
}

describe('createSchedule', () => {
	it('stores the template and rule, and lists it with its next date', () => {
		const id = createSchedule(db, rentInput());
		expect(getSchedule(db, id, T)).toMatchObject({
			accountName: 'Bank',
			amount: -150000,
			payeeName: 'Landlord',
			categoryName: 'Rent',
			memo: 'rent',
			frequency: 'monthly',
			interval: 1,
			nextIndex: 0,
			nextDate: '2026-10-05',
			autoEnter: false,
			status: 'active',
			isSplit: false,
			splits: []
		});
		expect(listSchedules(db, T).map((s) => s.id)).toEqual([id]);
	});

	it('validates the template like a transaction, and the rule', () => {
		expect(() => createSchedule(db, rentInput({ categoryId: null }))).toThrow(
			code('CATEGORY_REQUIRED')
		);
		expect(() => createSchedule(db, rentInput({ accountId: broker }))).toThrow(
			code('CATEGORY_NOT_ALLOWED')
		);
		expect(() => createSchedule(db, rentInput({ interval: 0 }))).toThrow(code('INVALID_INPUT'));
		closeAccount(db, savings);
		expect(() => createSchedule(db, rentInput({ accountId: savings }))).toThrow(
			code('ACCOUNT_CLOSED')
		);
		expect(all(db, 'SELECT id FROM schedules')).toEqual([]);
	});

	it('keeps transfers and split lines', () => {
		const transfer = createSchedule(db, transferInput());
		expect(getSchedule(db, transfer, T)).toMatchObject({
			transferAccountName: 'Savings',
			payeeId: null,
			categoryId: null
		});
		const split = createSchedule(
			db,
			rentInput({
				categoryId: null,
				amount: -20000,
				splits: [
					{ categoryId: food, amount: -12000 },
					{ categoryId: fun, amount: -8000, memo: 'fun' }
				]
			})
		);
		expect(getSchedule(db, split, T)).toMatchObject({
			isSplit: true,
			splits: [
				expect.objectContaining({ categoryName: 'Food', amount: -12000 }),
				expect.objectContaining({ categoryName: 'Fun', amount: -8000, memo: 'fun' })
			]
		});
	});
});

describe('status', () => {
	it('is due for a manual schedule from its date, paused on a closed account, ended past its end', () => {
		const manual = createSchedule(db, rentInput());
		const auto = createSchedule(db, rentInput({ autoEnter: true }));
		const once = createSchedule(db, rentInput({ frequency: 'once', startDate: '2026-09-01' }));
		const onSavings = createSchedule(db, rentInput({ accountId: savings }));
		skipOccurrence(db, once, 0);
		closeAccount(db, savings);
		const status = (id: string, today = '2026-10-05') => getSchedule(db, id, today).status;
		expect(status(manual, '2026-10-04')).toBe('active');
		expect(status(manual)).toBe('due');
		expect(status(auto)).toBe('active');
		expect(status(once)).toBe('ended');
		expect(status(onSavings)).toBe('paused');
		expect(getSchedule(db, once, T).nextDate).toBeNull();
	});
});

describe('upcomingOccurrences', () => {
	it('lists occurrences up to the horizon, overdue ones first, and both legs of a transfer', () => {
		const rentId = createSchedule(db, rentInput({ startDate: '2026-09-05' }));
		const transfer = createSchedule(
			db,
			transferInput({ startDate: '2026-09-28', frequency: 'weekly', autoEnter: true })
		);
		const upcoming = (accountId?: string) =>
			upcomingOccurrences(db, { accountId, today: T, to: '2026-10-10' });

		expect(upcoming(bank).map((o) => [o.scheduleId, o.date, o.amount, o.isNext, o.due])).toEqual([
			[rentId, '2026-09-05', -150000, true, true],
			[transfer, '2026-09-28', -30000, true, false],
			[rentId, '2026-10-05', -150000, false, false],
			[transfer, '2026-10-05', -30000, false, false]
		]);
		expect(upcoming(savings)).toEqual([
			expect.objectContaining({
				scheduleId: transfer,
				date: '2026-09-28',
				accountId: savings,
				amount: 30000,
				transferAccountId: bank,
				transferAccountName: 'Bank'
			}),
			expect.objectContaining({ date: '2026-10-05', amount: 30000 })
		]);
		// Across every account, a transfer shows once per occurrence, from its own account.
		expect(upcoming().filter((o) => o.scheduleId === transfer)).toHaveLength(2);
	});

	it('leaves out paused schedules', () => {
		createSchedule(db, rentInput({ accountId: savings }));
		closeAccount(db, savings);
		expect(upcomingOccurrences(db, { accountId: savings, today: T, to: '2026-12-31' })).toEqual([]);
	});
});

describe('enter and skip', () => {
	it('enters the next occurrence, with the edits made in the dialog, and moves on', () => {
		const id = createSchedule(db, rentInput());
		const txnId = enterOccurrence(db, id, 0, {
			accountId: bank,
			date: '2026-10-06',
			amount: -155000,
			payeeName: 'Landlord',
			categoryId: rent
		});
		expect(listTransactions(db)).toEqual([
			expect.objectContaining({
				id: txnId,
				date: '2026-10-06',
				amount: -155000,
				categoryName: 'Rent'
			})
		]);
		expect(getSchedule(db, id, T)).toMatchObject({
			nextIndex: 1,
			nextDate: '2026-11-05',
			amount: -150000
		});
	});

	it('skips an occurrence without a transaction', () => {
		const id = createSchedule(db, rentInput());
		skipOccurrence(db, id, 0);
		expect(listTransactions(db)).toEqual([]);
		expect(getSchedule(db, id, T).nextDate).toBe('2026-11-05');
	});

	it('refuses a stale or ended occurrence', () => {
		const id = createSchedule(db, rentInput({ endCount: 1 }));
		expect(() => skipOccurrence(db, id, 1)).toThrow(code('SCHEDULE_STALE'));
		skipOccurrence(db, id, 0);
		expect(() => skipOccurrence(db, id, 0)).toThrow(code('SCHEDULE_STALE'));
		expect(() =>
			enterOccurrence(db, id, 1, {
				accountId: bank,
				date: '2026-11-05',
				amount: -1,
				categoryId: rent
			})
		).toThrow(code('SCHEDULE_ENDED'));
		expect(listTransactions(db)).toEqual([]);
	});

	it('leaves the cursor alone when the transaction is invalid', () => {
		const id = createSchedule(db, rentInput());
		expect(() =>
			enterOccurrence(db, id, 0, { accountId: bank, date: '2026-10-05', amount: -1 })
		).toThrow(code('CATEGORY_REQUIRED'));
		expect(getSchedule(db, id, T).nextIndex).toBe(0);
	});
});

describe('enterDueOccurrences', () => {
	it('catches up every due occurrence of automatic schedules, each on its own date', () => {
		const auto = createSchedule(db, rentInput({ autoEnter: true, startDate: '2026-07-05' }));
		const manual = createSchedule(db, rentInput({ startDate: '2026-07-05' }));
		expect(enterDueOccurrences(db, T)).toBe(3);
		expect(listTransactions(db).map((t) => t.date)).toEqual([
			'2026-09-05',
			'2026-08-05',
			'2026-07-05'
		]);
		expect(getSchedule(db, auto, T).nextDate).toBe('2026-10-05');
		expect(getSchedule(db, manual, T).nextIndex).toBe(0);
		expect(enterDueOccurrences(db, T)).toBe(0);
	});

	it('enters transfers once and skips paused schedules', () => {
		const old = createAccount(db, {
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01',
			name: 'Old',
			type: 'checking'
		});
		createSchedule(db, rentInput({ accountId: old, autoEnter: true, startDate: '2026-09-01' }));
		closeAccount(db, old);
		createSchedule(db, transferInput({ autoEnter: true, startDate: '2026-09-01' }));
		expect(enterDueOccurrences(db, T)).toBe(1);
		expect(getAccount(db, bank).balance).toBe(-30000);
		expect(getAccount(db, savings).balance).toBe(30000);
	});
});

describe('updateSchedule and deleteSchedule', () => {
	it('restarts the rule from a new next date', () => {
		const id = createSchedule(db, rentInput({ endCount: 12 }));
		skipOccurrence(db, id, 0);
		skipOccurrence(db, id, 1);
		updateSchedule(db, id, rentInput({ amount: -160000, startDate: '2026-12-10', endCount: 10 }));
		expect(getSchedule(db, id, T)).toMatchObject({
			amount: -160000,
			startDate: '2026-12-10',
			endCount: 10,
			nextIndex: 0,
			nextDate: '2026-12-10'
		});
	});

	it('keeps its place when the date and cadence stay, counting occurrences left', () => {
		const id = createSchedule(db, rentInput({ endCount: 12 }));
		skipOccurrence(db, id, 0);
		skipOccurrence(db, id, 1);
		updateSchedule(db, id, rentInput({ amount: -160000, startDate: '2026-12-05', endCount: 10 }));
		expect(getSchedule(db, id, T)).toMatchObject({
			amount: -160000,
			startDate: '2026-10-05',
			endCount: 12,
			nextIndex: 2,
			nextDate: '2026-12-05'
		});
	});

	it('keeps the day a month-end schedule repeats on when only the amount changes', () => {
		const id = createSchedule(db, rentInput({ startDate: '2026-01-31' }));
		skipOccurrence(db, id, 0);
		// February is clamped to the 28th; the form shows that as the next date.
		updateSchedule(db, id, rentInput({ startDate: '2026-02-28', amount: -160000 }));
		skipOccurrence(db, id, 1);
		expect(getSchedule(db, id, T)).toMatchObject({ amount: -160000, nextDate: '2026-03-31' });
	});

	it('does not replay an ended schedule when its end moves later', () => {
		const id = createSchedule(
			db,
			rentInput({ autoEnter: true, startDate: '2026-07-05', endDate: '2026-08-05' })
		);
		expect(enterDueOccurrences(db, T)).toBe(2);
		expect(getSchedule(db, id, T).status).toBe('ended');
		// The form offers the date after the last occurrence: 2026-09-05.
		updateSchedule(
			db,
			id,
			rentInput({ autoEnter: true, startDate: '2026-09-05', endDate: '2027-08-05' })
		);
		expect(enterDueOccurrences(db, T)).toBe(1);
		expect(listTransactions(db).map((t) => t.date)).toEqual([
			'2026-09-05',
			'2026-08-05',
			'2026-07-05'
		]);
	});

	it('keeps an entered one-time schedule ended when only its memo changes', () => {
		const id = createSchedule(
			db,
			rentInput({ frequency: 'once', autoEnter: true, startDate: '2026-09-01' })
		);
		expect(enterDueOccurrences(db, T)).toBe(1);
		updateSchedule(
			db,
			id,
			rentInput({ frequency: 'once', autoEnter: true, startDate: '2026-09-01', memo: 'paid' })
		);
		expect(getSchedule(db, id, T)).toMatchObject({ status: 'ended', memo: 'paid' });
		expect(enterDueOccurrences(db, T)).toBe(0);
	});

	it('deletes a schedule and its split lines', () => {
		const id = createSchedule(
			db,
			rentInput({
				categoryId: null,
				amount: -20000,
				splits: [
					{ categoryId: food, amount: -12000 },
					{ categoryId: fun, amount: -8000 }
				]
			})
		);
		deleteSchedule(db, id);
		expect(listSchedules(db, T)).toEqual([]);
		expect(all(db, 'SELECT id FROM schedule_splits')).toEqual([]);
	});

	it('refuses a schedule that does not exist', () => {
		expect(() => updateSchedule(db, 'nope', rentInput())).toThrow(code('NOT_FOUND'));
		expect(() => deleteSchedule(db, 'nope')).toThrow(code('NOT_FOUND'));
		expect(() => getSchedule(db, 'nope', T)).toThrow(code('NOT_FOUND'));
	});
});

describe('what schedules keep in use', () => {
	it('moves schedules and their split lines when a category is deleted', () => {
		const plain = createSchedule(db, rentInput({ categoryId: fun }));
		const split = createSchedule(
			db,
			rentInput({
				categoryId: null,
				amount: -20000,
				splits: [
					{ categoryId: food, amount: -12000 },
					{ categoryId: fun, amount: -8000 }
				]
			})
		);
		expect(categoryUsage(db, fun).used).toBe(true);
		deleteCategory(db, fun, food);
		expect(getSchedule(db, plain, T).categoryId).toBe(food);
		expect(getSchedule(db, split, T).splits.map((s) => s.categoryId)).toEqual([food, food]);
	});

	it('moves schedules to the payee they are merged into', () => {
		const id = createSchedule(db, rentInput({ payeeName: 'Landlord Inc' }));
		const target = getOrCreatePayee(db, 'Landlord')!;
		mergePayee(db, getSchedule(db, id, T).payeeId!, target);
		expect(getSchedule(db, id, T).payeeName).toBe('Landlord');
	});

	it('counts a payee that only a schedule uses as in use', () => {
		const id = createSchedule(db, rentInput());
		const payeeId = getSchedule(db, id, T).payeeId!;
		expect(listPayees(db).find((p) => p.id === payeeId)).toMatchObject({
			transactions: 0,
			schedules: 1
		});
		expect(deleteUnusedPayees(db)).toBe(0);
		expect(() => deletePayee(db, payeeId)).toThrow(code('PAYEE_IN_USE'));
	});

	it('deletes the schedules of a deleted account, on either leg', () => {
		const old = createAccount(db, {
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01',
			name: 'Old',
			type: 'checking'
		});
		createSchedule(db, rentInput({ accountId: old }));
		createSchedule(db, transferInput({ transferAccountId: old }));
		deleteAccount(db, old);
		expect(listSchedules(db, T)).toEqual([]);
	});
});
