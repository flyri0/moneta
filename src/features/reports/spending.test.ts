import { describe, it, expect } from 'vitest';
import type { TransactionRow } from '$db/repos/transactions';
import { amountInCategory, byGroup, topSegments, topSlices, withShares } from './spending';

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

const spent = (name: string, amount: number, groupName = 'Everyday') => ({
	categoryId: name.toLowerCase(),
	name,
	groupName,
	amount
});

describe('topSegments', () => {
	it('is empty without spending', () => {
		expect(topSegments([])).toEqual({ total: 0, segments: [], other: null });
	});

	it('gives each of the first rows a colour, with no remainder when they are all there is', () => {
		const { segments, other } = topSegments([spent('Rent', 600), spent('Food', 400)]);
		expect(segments).toEqual([
			{ key: 'rent', label: 'Rent', amount: 600, share: 60, color: 1 },
			{ key: 'food', label: 'Food', amount: 400, share: 40, color: 2 }
		]);
		expect(other).toBeNull();
	});

	it('folds everything past the first n into one remainder', () => {
		const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => spent(n, 70 - i * 10));
		const { total, segments, other } = topSegments(rows);
		expect(total).toBe(280);
		expect(segments.map((s) => s.color)).toEqual([1, 2, 3, 4, 5]);
		expect(other).toEqual({ count: 2, amount: 30, share: (30 / 280) * 100 });
	});

	it('takes n', () => {
		expect(topSegments([spent('A', 3), spent('B', 2), spent('C', 1)], 1)).toMatchObject({
			segments: [{ key: 'a' }],
			other: { count: 2, amount: 3 }
		});
	});
});

describe('byGroup', () => {
	it('sums categories into their groups, largest first, then by name', () => {
		expect(
			byGroup([
				spent('Rent', 500, 'Bills'),
				spent('Food', 300),
				spent('Gym', 400, 'Health'),
				spent('Power', 100, 'Bills'),
				spent('Fun', 100)
			])
		).toEqual([
			{ categoryId: 'Bills', name: 'Bills', groupName: '', amount: 600 },
			{ categoryId: 'Everyday', name: 'Everyday', groupName: '', amount: 400 },
			{ categoryId: 'Health', name: 'Health', groupName: '', amount: 400 }
		]);
	});
});

describe('topSlices', () => {
	it('colours the first slices and folds the rest, for any keyed amounts', () => {
		const top = topSlices(
			[
				{ key: 'market', label: 'Market', amount: 600 },
				{ key: 'cinema', label: 'Cinema', amount: 300 },
				{ key: 'gym', label: 'Gym', amount: 100 }
			],
			2
		);
		expect(top.total).toBe(1000);
		expect(top.segments.map((s) => [s.key, s.color, s.share])).toEqual([
			['market', 1, 60],
			['cinema', 2, 30]
		]);
		expect(top.other).toEqual({ count: 1, amount: 100, share: 10 });
	});
});
