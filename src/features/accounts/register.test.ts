import { describe, it, expect } from 'vitest';
import { payeeDisplay, registerBalances } from './register';

const row = { amount: -500, payeeName: null, transferAccountId: null, transferAccountName: null };

describe('payeeDisplay', () => {
	it('shows transfers by direction and other account', () => {
		const transfer = { ...row, transferAccountId: 'sav', transferAccountName: 'Savings' };
		expect(payeeDisplay(transfer)).toEqual({
			kind: 'transfer',
			direction: 'to',
			accountId: 'sav',
			accountName: 'Savings'
		});
		expect(payeeDisplay({ ...transfer, amount: 500 })).toMatchObject({ direction: 'from' });
	});

	it('recognizes starting balances, payees and blanks', () => {
		expect(payeeDisplay({ ...row, payeeName: 'Starting Balance' })).toEqual({
			kind: 'starting-balance'
		});
		expect(payeeDisplay({ ...row, payeeName: 'Mercado' })).toEqual({
			kind: 'payee',
			name: 'Mercado'
		});
		expect(payeeDisplay(row)).toEqual({ kind: 'none' });
	});
});

describe('registerBalances', () => {
	it('derives the uncleared balance', () => {
		expect(registerBalances({ balance: 1000, clearedBalance: 700 })).toEqual({
			cleared: 700,
			uncleared: 300,
			total: 1000
		});
	});
});
