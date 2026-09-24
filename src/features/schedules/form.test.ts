import { describe, it, expect } from 'vitest';
import type { GroupNode } from '$db/repos/categories';
import type { ScheduleRow } from '$db/repos/schedules';
import type { FormContext } from '$features/transactions/form';
import {
	buildScheduleInput,
	draftFromSchedule,
	newScheduleDraft,
	ruleSummary,
	type ScheduleDraft
} from './form';

const tree: GroupNode[] = [
	{
		id: 'bills',
		name: 'Bills',
		sortOrder: 0,
		hidden: false,
		system: null,
		categories: [
			{
				id: 'rent',
				groupId: 'bills',
				name: 'Rent',
				sortOrder: 0,
				hidden: false,
				carryoverOverspending: false
			}
		]
	}
];

const ctx: FormContext = {
	accounts: [
		{ id: 'bank', name: 'Bank', type: 'checking', onBudget: true, closed: false },
		{ id: 'savings', name: 'Savings', type: 'savings', onBudget: true, closed: false }
	],
	payees: [],
	tree,
	money: { currency: 'USD', locale: 'en-US' }
};

function rentDraft(): ScheduleDraft {
	const draft = newScheduleDraft('bank', '2026-10-05');
	draft.txn.payee = 'Landlord';
	draft.txn.amount = '1500';
	draft.txn.categoryId = 'rent';
	return draft;
}

const schedule = (over: Partial<ScheduleRow> = {}): ScheduleRow => ({
	id: 's1',
	accountId: 'bank',
	accountName: 'Bank',
	amount: -150000,
	payeeId: 'p1',
	payeeName: 'Landlord',
	categoryId: 'rent',
	categoryName: 'Rent',
	transferAccountId: null,
	transferAccountName: null,
	memo: '',
	isSplit: false,
	splits: [],
	autoEnter: false,
	startDate: '2026-08-01',
	frequency: 'monthly',
	interval: 1,
	endDate: null,
	endCount: null,
	weekend: 'keep',
	nextIndex: 0,
	nextDate: '2026-08-01',
	status: 'active',
	...over
});

describe('newScheduleDraft', () => {
	it('starts monthly, entered by hand, with no end', () => {
		expect(newScheduleDraft('bank', '2026-10-05')).toMatchObject({
			txn: { accountId: 'bank', date: '2026-10-05' },
			rule: { frequency: 'monthly', interval: '1', weekend: 'keep', ends: 'never' },
			autoEnter: false
		});
	});
});

describe('buildScheduleInput', () => {
	it('turns a draft into the repo input, the date being the start', () => {
		expect(buildScheduleInput(rentDraft(), ctx)).toEqual({
			ok: true,
			input: {
				accountId: 'bank',
				amount: -150000,
				payeeName: 'Landlord',
				categoryId: 'rent',
				memo: '',
				splits: undefined,
				transferAccountId: null,
				startDate: '2026-10-05',
				frequency: 'monthly',
				interval: 1,
				endDate: null,
				endCount: null,
				weekend: 'keep',
				autoEnter: false
			}
		});
	});

	it('reads the end and the interval', () => {
		const onDate = rentDraft();
		onDate.rule = { ...onDate.rule, interval: '2', ends: 'on', endDate: '2027-10-05' };
		expect(buildScheduleInput(onDate, ctx)).toMatchObject({
			ok: true,
			input: { interval: 2, endDate: '2027-10-05', endCount: null }
		});
		const afterCount = rentDraft();
		afterCount.rule = { ...afterCount.rule, ends: 'after', endCount: '6' };
		expect(buildScheduleInput(afterCount, ctx)).toMatchObject({
			ok: true,
			input: { endDate: null, endCount: 6 }
		});
	});

	it('reports bad rule fields and passes transaction errors through', () => {
		const bad = (change: (d: ScheduleDraft) => void) => {
			const draft = rentDraft();
			change(draft);
			return buildScheduleInput(draft, ctx);
		};
		expect(bad((d) => (d.rule.interval = '0'))).toEqual({ ok: false, error: 'INTERVAL_INVALID' });
		expect(bad((d) => Object.assign(d.rule, { ends: 'on', endDate: '2026-10-04' }))).toEqual({
			ok: false,
			error: 'END_DATE_INVALID'
		});
		expect(bad((d) => Object.assign(d.rule, { ends: 'after', endCount: '' }))).toEqual({
			ok: false,
			error: 'END_COUNT_INVALID'
		});
		expect(bad((d) => (d.txn.amount = ''))).toEqual({ ok: false, error: 'AMOUNT_INVALID' });
	});

	it('ignores the interval and end of a one-time schedule, and the weekend rule of a daily one', () => {
		const once = rentDraft();
		once.rule = { ...once.rule, frequency: 'once', interval: 'x', ends: 'after', endCount: '' };
		expect(buildScheduleInput(once, ctx)).toMatchObject({
			ok: true,
			input: { frequency: 'once', interval: 1, endCount: null }
		});
		const daily = rentDraft();
		daily.rule = { ...daily.rule, frequency: 'daily', weekend: 'before' };
		expect(buildScheduleInput(daily, ctx)).toMatchObject({ ok: true, input: { weekend: 'keep' } });
	});
});

describe('draftFromSchedule', () => {
	it('edits from the next occurrence, with the occurrences left', () => {
		const draft = draftFromSchedule(
			schedule({ startDate: '2026-01-05', nextIndex: 2, nextDate: '2026-03-05', endCount: 12 }),
			ctx
		);
		expect(draft).toMatchObject({
			txn: { date: '2026-03-05', payee: 'Landlord', amount: '1500.00', direction: 'outflow' },
			rule: { ends: 'after', endCount: '10' }
		});
		expect(buildScheduleInput(draft, ctx)).toMatchObject({
			ok: true,
			input: { startDate: '2026-03-05', endCount: 10, amount: -150000 }
		});
	});

	it('offers the date after the last occurrence for an ended schedule', () => {
		const draft = draftFromSchedule(
			schedule({
				startDate: '2026-07-05',
				endDate: '2026-08-05',
				nextIndex: 2,
				nextDate: null,
				status: 'ended'
			}),
			ctx
		);
		expect(draft.txn.date).toBe('2026-09-05');
	});

	it('rebases from the scheduled date, not the weekend-moved one', () => {
		// 2026-08-01 is a Saturday, moved to Friday 2026-07-31.
		const draft = draftFromSchedule(schedule({ weekend: 'before', nextDate: '2026-07-31' }), ctx);
		expect(draft.txn.date).toBe('2026-08-01');
	});
});

describe('ruleSummary', () => {
	it('says how often, in the UI language', () => {
		expect(ruleSummary({ frequency: 'once', interval: 1 })).toBe('Once');
		expect(ruleSummary({ frequency: 'monthly', interval: 1 })).toBe('Every month');
		expect(ruleSummary({ frequency: 'weekly', interval: 2 })).toBe('Every 2 weeks');
	});
});
