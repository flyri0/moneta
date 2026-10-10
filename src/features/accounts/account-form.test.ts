import { describe, it, expect } from 'vitest';
import type { Account, AccountType } from '$db/repos/accounts';
import {
	ACCOUNT_CATEGORIES,
	accountSections,
	defaultOnBudget,
	isDebtType,
	onBudgetLocked,
	parseBillingDays,
	signedStartingBalance
} from './account-form';

describe('account defaults', () => {
	it('puts loans, investments and other accounts off-budget by default', () => {
		expect(defaultOnBudget('checking')).toBe(true);
		expect(defaultOnBudget('credit_card')).toBe(true);
		expect(defaultOnBudget('investment')).toBe(false);
		expect(defaultOnBudget('loan')).toBe(false);
		expect(defaultOnBudget('other')).toBe(false);
	});

	it('locks credit cards on-budget', () => {
		expect(onBudgetLocked('credit_card')).toBe(true);
		expect(onBudgetLocked('loan')).toBe(false);
	});

	it('enters debts as the amount owed', () => {
		expect(isDebtType('credit_card')).toBe(true);
		expect(isDebtType('savings')).toBe(false);
		expect(signedStartingBalance('credit_card', 50000)).toBe(-50000);
		expect(signedStartingBalance('loan', -100)).toBe(100);
		expect(signedStartingBalance('checking', 50000)).toBe(50000);
		expect(Object.is(signedStartingBalance('loan', 0), 0)).toBe(true);
	});
});

/** Every account type the schema allows (accounts.type CHECK). */
const ACCOUNT_TYPES: readonly AccountType[] = [
	'checking',
	'savings',
	'cash',
	'credit_card',
	'investment',
	'loan',
	'other'
];

describe('account categories', () => {
	it('groups every account type into budget or tracking without duplicates', () => {
		const categoryKeys = ACCOUNT_CATEGORIES.map((c) => c.key);
		expect(categoryKeys).toEqual(['budget', 'tracking']);

		const allTypesInCategories = ACCOUNT_CATEGORIES.flatMap((c) => c.types);
		expect([...allTypesInCategories].sort()).toEqual([...ACCOUNT_TYPES].sort());
		expect(allTypesInCategories.length).toBe(ACCOUNT_TYPES.length);
	});
});

describe('accountSections', () => {
	const account = (p: Partial<Account>): Account => ({
		id: p.name ?? 'x',
		name: 'x',
		icon: null,
		type: 'checking',
		onBudget: true,
		closed: false,
		sortOrder: 0,
		balance: 0,
		clearedBalance: 0,
		upcoming: 0,
		reconciledOn: null,
		closingDay: null,
		dueDay: null,
		...p
	});

	it('splits accounts into on-budget, off-budget and closed, with totals', () => {
		const sections = accountSections([
			account({ name: 'Bank', balance: 1000 }),
			account({ name: 'Visa', type: 'credit_card', balance: -300 }),
			account({ name: 'Broker', onBudget: false, balance: 5000 }),
			account({ name: 'Old', closed: true })
		]);
		expect(sections.map((s) => [s.key, s.accounts.map((a) => a.name), s.total])).toEqual([
			['onBudget', ['Bank', 'Visa'], 700],
			['offBudget', ['Broker'], 5000],
			['closed', ['Old'], 0]
		]);
	});

	it('leaves out empty sections', () => {
		expect(accountSections([account({ name: 'Bank' })]).map((s) => s.key)).toEqual(['onBudget']);
	});
});

describe('parseBillingDays', () => {
	it('reads both days', () => {
		expect(parseBillingDays(' 5 ', '15')).toEqual({ closingDay: 5, dueDay: 15 });
		expect(parseBillingDays('31', '1')).toEqual({ closingDay: 31, dueDay: 1 });
	});

	it('is null when both are blank', () => {
		expect(parseBillingDays('', '  ')).toBeNull();
	});

	it('is invalid with only one day, or a day that is not 1 to 31', () => {
		for (const [closing, due] of [
			['5', ''],
			['', '15'],
			['0', '15'],
			['5', '32'],
			['5.5', '15'],
			['x', '15']
		])
			expect(parseBillingDays(closing, due)).toBe('invalid');
	});
});
