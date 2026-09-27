import { describe, it, expect } from 'vitest';
import { newDraft, type FormContext, type TransactionDraft } from './form';
import { canInstall, installmentCount, installmentPlan } from './installments';

const ctx: FormContext = {
	accounts: [
		{ id: 'visa', name: 'Visa', type: 'credit_card', onBudget: true, closed: false },
		{ id: 'bank', name: 'Bank', type: 'checking', onBudget: true, closed: false }
	],
	payees: [],
	tree: [],
	money: { currency: 'BRL', locale: 'pt-BR' }
};

const draft = (p: Partial<TransactionDraft> = {}): TransactionDraft => ({
	...newDraft('visa', '2026-09-05'),
	amount: '1.000,00',
	...p
});

describe('canInstall', () => {
	it('is for card purchases', () => {
		expect(canInstall(draft(), ctx)).toBe(true);
		expect(canInstall(draft({ accountId: 'bank' }), ctx)).toBe(false);
		expect(canInstall(draft({ direction: 'inflow' }), ctx)).toBe(false);
		expect(canInstall(draft({ transferAccountId: 'bank' }), ctx)).toBe(false);
		expect(canInstall(draft({ splits: [] }), ctx)).toBe(false);
	});
});

describe('installmentCount', () => {
	it('is 1 when blank, 1, or not a card purchase', () => {
		expect(installmentCount(draft(), ctx, '')).toBe(1);
		expect(installmentCount(draft(), ctx, ' 1 ')).toBe(1);
		expect(installmentCount(draft({ accountId: 'bank' }), ctx, '12')).toBe(1);
	});

	it('reads 2 to 99', () => {
		expect(installmentCount(draft(), ctx, '12')).toBe(12);
		expect(installmentCount(draft(), ctx, '99')).toBe(99);
	});

	it('is null for anything else, or installments under a cent', () => {
		for (const text of ['0', '100', '2.5', 'x', '-3']) {
			expect(installmentCount(draft(), ctx, text)).toBeNull();
		}
		expect(installmentCount(draft({ amount: '0,02' }), ctx, '3')).toBeNull();
	});
});

describe('installmentPlan', () => {
	it('splits the total, the first installment taking the leftover cents', () => {
		expect(installmentPlan(draft(), ctx, '3')).toEqual({ count: 3, first: 33334, rest: 33333 });
		expect(installmentPlan(draft(), ctx, '4')).toEqual({ count: 4, first: 25000, rest: 25000 });
	});

	it('is null for a single payment or an amount it cannot read', () => {
		expect(installmentPlan(draft(), ctx, '1')).toBeNull();
		expect(installmentPlan(draft(), ctx, 'x')).toBeNull();
		expect(installmentPlan(draft({ amount: '' }), ctx, '3')).toBeNull();
	});
});
