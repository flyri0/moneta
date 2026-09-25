import { describe, it, expect } from 'vitest';
import type { Account } from '$db/repos/accounts';
import { accountBreakdown, debtProgress } from './accounts-breakdown';

const account = (id: string, balance: number, fields: Partial<Account> = {}): Account => ({
	id,
	name: id,
	type: 'checking',
	onBudget: true,
	closed: false,
	sortOrder: 0,
	balance,
	clearedBalance: balance,
	...fields
});

describe('accountBreakdown', () => {
	it('splits open accounts into assets and debts, largest first', () => {
		const breakdown = accountBreakdown([
			account('bank', 200000),
			account('visa', -30000, { type: 'credit_card' }),
			account('broker', 500000, { type: 'investment', onBudget: false }),
			account('loan', -900000, { type: 'loan', onBudget: false }),
			account('empty', 0),
			account('old', 7000, { closed: true })
		]);
		expect(breakdown.assets.map((a) => [a.id, a.amount])).toEqual([
			['broker', 500000],
			['bank', 200000]
		]);
		expect(breakdown.debts.map((a) => [a.id, a.amount, a.type])).toEqual([
			['loan', 900000, 'loan'],
			['visa', 30000, 'credit_card']
		]);
		expect(breakdown.totalAssets).toBe(700000);
		expect(breakdown.totalDebts).toBe(930000);
	});
});

describe('debtProgress', () => {
	const series = [
		{ month: '2026-07', balances: { loan: -1000, bank: 50 } },
		{ month: '2026-08', balances: { loan: -800, bank: 50 } },
		{ month: '2026-09', balances: { loan: -600, bank: 50 } }
	];

	it('measures what was paid off against the peak of the debt', () => {
		expect(debtProgress(series, 'loan')).toEqual({ peak: 1000, current: 600, paid: 0.4 });
	});

	it('is null for an account that never owed anything', () => {
		expect(debtProgress(series, 'bank')).toBeNull();
		expect(debtProgress([], 'loan')).toBeNull();
	});
});
