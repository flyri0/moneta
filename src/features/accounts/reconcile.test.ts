import { describe, expect, it } from 'vitest';
import { checkBalance, shownBalance } from './reconcile';

describe('shownBalance', () => {
	it('shows what a debt account owes as a positive amount', () => {
		expect(shownBalance('credit_card', -12000)).toBe(12000);
		expect(shownBalance('loan', -500)).toBe(500);
		expect(shownBalance('checking', -500)).toBe(-500);
		expect(shownBalance('credit_card', 0)).toBe(0);
	});
});

describe('checkBalance', () => {
	it('refuses an amount that did not parse', () => {
		expect(checkBalance('checking', null, 100)).toEqual({ kind: 'invalid' });
	});

	it('matches the cleared balance', () => {
		expect(checkBalance('checking', 7500, 7500)).toEqual({ kind: 'match', balance: 7500 });
	});

	it('gives the difference an adjustment would add', () => {
		expect(checkBalance('checking', 7000, 7500)).toEqual({
			kind: 'difference',
			balance: 7000,
			difference: -500
		});
	});

	it('reads what a card owes as a negative balance', () => {
		expect(checkBalance('credit_card', 12000, -12000)).toEqual({ kind: 'match', balance: -12000 });
		expect(checkBalance('credit_card', 12500, -12000)).toEqual({
			kind: 'difference',
			balance: -12500,
			difference: -500
		});
	});
});
