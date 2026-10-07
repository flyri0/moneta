import { describe, it, expect } from 'vitest';
import type { GroupNode } from '$db/repos/categories';
import type { ScheduleRow } from '$db/repos/schedules';
import type { FormContext } from '$features/transactions/form';
import {
	buildScheduleInput,
	draftFromSchedule,
	draftRuleSummary,
	installmentDate,
	installmentsLeft,
	newScheduleDraft,
	nextOccurrences,
	ruleSummary,
	scheduleInstallments,
	type ScheduleDraft
} from './form';

const tree: GroupNode[] = [
	{
		id: 'bills',
		name: 'Bills',
		icon: null,
		sortOrder: 0,
		hidden: false,
		system: null,
		categories: [
			{
				id: 'rent',
				groupId: 'bills',
				name: 'Rent',
				icon: null,
				sortOrder: 0,
				hidden: false,
				carryoverOverspending: false,
				goal: null
			}
		]
	}
];

const ctx: FormContext = {
	accounts: [
		{ id: 'bank', name: 'Bank', type: 'checking', onBudget: true, closed: false },
		{ id: 'savings', name: 'Savings', type: 'savings', onBudget: true, closed: false },
		{ id: 'card', name: 'Card', type: 'credit_card', onBudget: true, closed: false },
		{
			id: 'billed',
			name: 'Billed',
			type: 'credit_card',
			onBudget: true,
			closed: false,
			closingDay: 3,
			dueDay: 10
		}
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
	installmentStart: null,
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
				autoEnter: false,
				installmentStart: null
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

	it('reads the installment numbers of a schedule that pays installments', () => {
		const draft = draftFromSchedule(
			schedule({
				accountId: 'card',
				endCount: 12,
				nextIndex: 3,
				installmentStart: 1,
				memo: 'TV'
			}),
			ctx
		);
		expect(draft).toMatchObject({
			installments: {
				on: true,
				next: '4',
				total: '12',
				kept: { accountId: 'card', date: '2026-11-01' }
			},
			txn: { memo: 'TV' }
		});
		expect(buildScheduleInput(draft, ctx)).toMatchObject({
			input: { installmentStart: 4, endCount: 9, startDate: '2026-11-01' }
		});
		draft.installments.on = false;
		expect(buildScheduleInput(draft, ctx)).toMatchObject({ input: { installmentStart: null } });
	});

	it('rebases from the scheduled date, not the weekend-moved one', () => {
		// 2026-08-01 is a Saturday, moved to Friday 2026-07-31.
		const draft = draftFromSchedule(schedule({ weekend: 'before', nextDate: '2026-07-31' }), ctx);
		expect(draft.txn.date).toBe('2026-08-01');
	});
});

describe('installments already under way', () => {
	const T = '2026-10-04';

	function tvDraft(accountId = 'card'): ScheduleDraft {
		const draft = newScheduleDraft(accountId, '2026-10-20', { installments: true });
		draft.txn.payee = 'Store';
		draft.txn.amount = '80';
		draft.txn.memo = 'TV';
		draft.txn.categoryId = 'rent';
		draft.installments.next = '4';
		draft.installments.total = '12';
		return draft;
	}

	it('starts entered automatically, like a new purchase', () => {
		expect(newScheduleDraft('card', T, { installments: true })).toMatchObject({
			autoEnter: true,
			installments: { on: true, next: '', total: '', kept: null }
		});
	});

	it('is monthly and ends after the last installment, whatever the repeat screen holds', () => {
		const draft = tvDraft();
		draft.rule = { ...draft.rule, frequency: 'weekly', interval: '2', ends: 'never' };
		draft.rule.weekend = 'after';
		expect(buildScheduleInput(draft, ctx, T)).toMatchObject({
			ok: true,
			input: {
				accountId: 'card',
				amount: -8000,
				startDate: '2026-10-20',
				frequency: 'monthly',
				interval: 1,
				weekend: 'keep',
				endDate: null,
				endCount: 9,
				installmentStart: 4,
				autoEnter: true
			}
		});
	});

	it('reports numbers out of range or out of order', () => {
		const bad = (next: string, total: string) => {
			const draft = tvDraft();
			draft.installments = { ...draft.installments, next, total };
			return buildScheduleInput(draft, ctx, T);
		};
		expect(bad('', '12')).toEqual({ ok: false, error: 'INSTALLMENT_NUMBER_INVALID' });
		expect(bad('0', '12')).toEqual({ ok: false, error: 'INSTALLMENT_NUMBER_INVALID' });
		expect(bad('100', '100')).toEqual({ ok: false, error: 'INSTALLMENT_NUMBER_INVALID' });
		expect(bad('4', '')).toEqual({ ok: false, error: 'INSTALLMENT_TOTAL_INVALID' });
		expect(bad('4', '3')).toEqual({ ok: false, error: 'INSTALLMENT_TOTAL_INVALID' });
		expect(bad(' 12 ', '12')).toMatchObject({ ok: true, input: { endCount: 1 } });
	});

	it('falls on the card’s next due date when the card has billing days', () => {
		const draft = tvDraft('billed');
		expect(installmentDate(draft, ctx, T)).toBe('2026-10-10');
		expect(installmentDate(draft, ctx, '2026-10-11')).toBe('2026-11-10');
		expect(buildScheduleInput(draft, ctx, T)).toMatchObject({
			input: { startDate: '2026-10-10' }
		});
	});

	it('is typed on an account without billing days, or when not paying installments', () => {
		expect(installmentDate(tvDraft('card'), ctx, T)).toBeNull();
		const off = tvDraft('billed');
		off.installments.on = false;
		expect(installmentDate(off, ctx, T)).toBeNull();
	});

	it('keeps an edited schedule’s own date on its account, and not on another', () => {
		const draft = draftFromSchedule(
			schedule({
				accountId: 'billed',
				startDate: '2026-09-10',
				endCount: 12,
				nextIndex: 0,
				installmentStart: 1
			}),
			ctx
		);
		expect(installmentDate(draft, ctx, T)).toBe('2026-09-10');
		draft.txn.accountId = 'card';
		expect(installmentDate(draft, ctx, T)).toBeNull();
		ctx.accounts.push({ ...ctx.accounts[3], id: 'billed2' });
		draft.txn.accountId = 'billed2';
		expect(installmentDate(draft, ctx, T)).toBe('2026-10-10');
		ctx.accounts.pop();
	});

	it('only counts on a card purchase, as a new purchase in installments', () => {
		const onBank = tvDraft('bank');
		expect(buildScheduleInput(onBank, ctx, T)).toMatchObject({
			ok: true,
			input: { installmentStart: null, endCount: null }
		});
		expect(installmentsLeft(onBank, ctx)).toBeNull();
		const income = tvDraft('billed');
		income.txn.direction = 'inflow';
		expect(installmentDate(income, ctx, T)).toBeNull();
		expect(buildScheduleInput(income, ctx, T)).toMatchObject({ input: { installmentStart: null } });
	});

	it('refuses a past date for the next installment, or a zero amount', () => {
		const past = tvDraft();
		past.txn.date = '2026-10-03';
		expect(buildScheduleInput(past, ctx, T)).toEqual({ ok: false, error: 'INSTALLMENT_DATE_PAST' });
		past.txn.date = T;
		expect(buildScheduleInput(past, ctx, T)).toMatchObject({ ok: true });
		const zero = tvDraft();
		zero.txn.amount = '0';
		expect(buildScheduleInput(zero, ctx, T)).toEqual({ ok: false, error: 'INSTALLMENTS_INVALID' });
	});

	it('lets an edited schedule keep its own date, even a due one', () => {
		const draft = draftFromSchedule(
			schedule({ accountId: 'card', startDate: '2026-09-10', endCount: 12, installmentStart: 1 }),
			ctx
		);
		draft.txn.categoryId = 'rent';
		expect(buildScheduleInput(draft, ctx, T)).toMatchObject({
			ok: true,
			input: { startDate: '2026-09-10' }
		});
	});

	it('counts what is left and what it comes to', () => {
		expect(installmentsLeft(tvDraft(), ctx)).toEqual({ left: 9, next: 4, total: 12, sum: 72000 });
		const noAmount = tvDraft();
		noAmount.txn.amount = '';
		expect(installmentsLeft(noAmount, ctx)).toMatchObject({ left: 9, sum: null });
		const bad = tvDraft();
		bad.installments.next = '13';
		expect(installmentsLeft(bad, ctx)).toBeNull();
		const off = tvDraft();
		off.installments.on = false;
		expect(installmentsLeft(off, ctx)).toBeNull();
	});
});

describe('ruleSummary', () => {
	it('says how often, in the UI language', () => {
		expect(ruleSummary({ frequency: 'once', interval: 1 })).toBe('Once');
		expect(ruleSummary({ frequency: 'monthly', interval: 1 })).toBe('Every month');
		expect(ruleSummary({ frequency: 'weekly', interval: 2 })).toBe('Every 2 weeks');
	});
});

describe('draftRuleSummary', () => {
	const rule = newScheduleDraft('checking', '2026-01-01').rule;

	it('summarizes the rule as typed', () => {
		expect(draftRuleSummary({ ...rule, frequency: 'monthly', interval: '1' })).toBe('Every month');
		expect(draftRuleSummary({ ...rule, frequency: 'weekly', interval: ' 2 ' })).toBe(
			'Every 2 weeks'
		);
		expect(draftRuleSummary({ ...rule, frequency: 'once', interval: 'x' })).toBe('Once');
	});

	it('names only the frequency while the interval is not a whole number', () => {
		expect(draftRuleSummary({ ...rule, frequency: 'weekly', interval: '' })).toBe('Weekly');
		expect(draftRuleSummary({ ...rule, frequency: 'yearly', interval: '0' })).toBe('Yearly');
	});
});

describe('nextOccurrences', () => {
	it("lists the next dates from the schedule's next occurrence on", () => {
		expect(nextOccurrences(schedule({ nextIndex: 2 }), 3)).toEqual([
			{ index: 2, date: '2026-10-01', installment: null },
			{ index: 3, date: '2026-11-01', installment: null },
			{ index: 4, date: '2026-12-01', installment: null }
		]);
	});

	it('stops at the end of the rule', () => {
		expect(nextOccurrences(schedule({ nextIndex: 1, endCount: 2 }), 5)).toEqual([
			{ index: 1, date: '2026-09-01', installment: null }
		]);
		expect(nextOccurrences(schedule({ frequency: 'once', nextIndex: 1 }), 5)).toEqual([]);
	});

	it('numbers each installment', () => {
		const s = schedule({ installmentStart: 3, endCount: 4, nextIndex: 2 });
		expect(nextOccurrences(s, 5)).toEqual([
			{ index: 2, date: '2026-10-01', installment: 5 },
			{ index: 3, date: '2026-11-01', installment: 6 }
		]);
	});

	it('moves dates off the weekend as the rule says', () => {
		// 2026-08-01 is a Saturday.
		expect(nextOccurrences(schedule({ weekend: 'after' }), 1)).toEqual([
			{ index: 0, date: '2026-08-03', installment: null }
		]);
	});
});

describe('scheduleInstallments', () => {
	it('says which installment comes next, how many are left and what they come to', () => {
		const s = schedule({ installmentStart: 3, endCount: 4, nextIndex: 2, amount: -10000 });
		expect(scheduleInstallments(s)).toEqual({ next: 5, total: 6, left: 2, sum: 20000 });
	});

	it('is null for a schedule that pays no installments, or has paid them all', () => {
		expect(scheduleInstallments(schedule())).toBeNull();
		expect(
			scheduleInstallments(
				schedule({ installmentStart: 1, endCount: 3, nextIndex: 3, nextDate: null })
			)
		).toBeNull();
	});
});
