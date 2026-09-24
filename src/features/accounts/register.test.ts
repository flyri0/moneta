import { describe, it, expect } from 'vitest';
import { payeeDisplay, payeeText, projectBalances, registerBalances } from './register';

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
		expect(payeeDisplay({ ...row, payeeName: 'Saldo inicial' })).toEqual({
			kind: 'starting-balance'
		});
		expect(payeeDisplay({ ...row, payeeName: 'starting balance' })).toEqual({
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

describe('payeeText', () => {
	it('names transfers, starting balances, payees and blanks', () => {
		expect(
			payeeText({ kind: 'transfer', direction: 'to', accountId: 's', accountName: 'Savings' })
		).toBe('Transfer to Savings');
		expect(payeeText({ kind: 'starting-balance' })).toBe('Starting balance');
		expect(payeeText({ kind: 'payee', name: 'Landlord' })).toBe('Landlord');
		expect(payeeText({ kind: 'none' })).toBe('No payee');
	});
});

describe('projectBalances', () => {
	it('runs the balance through each occurrence in order', () => {
		expect(projectBalances(1000, [{ amount: -300 }, { amount: 500 }, { amount: -1500 }])).toEqual([
			700, 1200, -300
		]);
		expect(projectBalances(1000, [])).toEqual([]);
	});
});
