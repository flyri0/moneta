import { describe, it, expect } from 'vitest';
import type { TransactionRow } from '$db/repos/transactions';
import { amountInCategory, withShares } from './spending';

const row = (fields: Partial<TransactionRow>) => ({ ...({} as TransactionRow), ...fields });

describe('amountInCategory', () => {
	it('is the amount, or the sum of the split lines in that category', () => {
		expect(amountInCategory(row({ amount: -500, isSplit: false, splits: [] }), 'food')).toBe(-500);
		const split = row({
			amount: -900,
			isSplit: true,
			splits: [
				{ id: '1', categoryId: 'food', categoryName: 'Food', amount: -300, memo: '' },
				{ id: '2', categoryId: 'fun', categoryName: 'Fun', amount: -500, memo: '' },
				{ id: '3', categoryId: 'food', categoryName: 'Food', amount: -100, memo: '' }
			]
		});
		expect(amountInCategory(split, 'food')).toBe(-400);
	});
});

describe('withShares', () => {
	it('adds each category’s share of the total, in percent', () => {
		expect(
			withShares([
				{ categoryId: 'a', name: 'Rent', groupName: 'Bills', amount: 7500 },
				{ categoryId: 'b', name: 'Food', groupName: 'Everyday', amount: 2500 }
			])
		).toEqual({
			total: 10000,
			rows: [
				{ categoryId: 'a', name: 'Rent', groupName: 'Bills', amount: 7500, share: 75 },
				{ categoryId: 'b', name: 'Food', groupName: 'Everyday', amount: 2500, share: 25 }
			]
		});
		expect(withShares([])).toEqual({ total: 0, rows: [] });
	});
});
