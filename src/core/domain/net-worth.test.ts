import { describe, it, expect } from 'vitest';
import { accountBalanceSeries, netWorthSeries } from './net-worth';

describe('netWorthSeries', () => {
	it('totals month-end balances into assets and debts', () => {
		const series = netWorthSeries(
			[
				{ accountId: 'bank', month: '2026-07', amount: 100000 },
				{ accountId: 'card', month: '2026-07', amount: -20000 },
				{ accountId: 'bank', month: '2026-09', amount: -30000 },
				{ accountId: 'card', month: '2026-09', amount: 25000 }
			],
			'2026-10'
		);
		expect(series).toEqual([
			{ month: '2026-07', assets: 100000, debts: -20000, netWorth: 80000 },
			{ month: '2026-08', assets: 100000, debts: -20000, netWorth: 80000 },
			{ month: '2026-09', assets: 75000, debts: 0, netWorth: 75000 },
			{ month: '2026-10', assets: 75000, debts: 0, netWorth: 75000 }
		]);
	});

	it('runs through the last month with data when that is later', () => {
		const series = netWorthSeries(
			[{ accountId: 'bank', month: '2026-11', amount: 500 }],
			'2026-09'
		);
		expect(series.map((p) => p.month)).toEqual(['2026-11']);
	});

	it('is empty without data', () => {
		expect(netWorthSeries([], '2026-09')).toEqual([]);
	});
});

describe('accountBalanceSeries', () => {
	it("carries each account's month-end balance forward, month by month", () => {
		const series = accountBalanceSeries(
			[
				{ accountId: 'bank', month: '2026-07', amount: 100000 },
				{ accountId: 'card', month: '2026-08', amount: -20000 },
				{ accountId: 'card', month: '2026-09', amount: 5000 }
			],
			'2026-10'
		);
		expect(series).toEqual([
			{ month: '2026-07', balances: { bank: 100000 } },
			{ month: '2026-08', balances: { bank: 100000, card: -20000 } },
			{ month: '2026-09', balances: { bank: 100000, card: -15000 } },
			{ month: '2026-10', balances: { bank: 100000, card: -15000 } }
		]);
	});

	it('is empty without transactions', () => {
		expect(accountBalanceSeries([], '2026-09')).toEqual([]);
	});
});

describe('a far-off date', () => {
	it('keeps a series quick when a typo dates a transaction in 2199', () => {
		const changes = [];
		for (let a = 0; a < 50; a++)
			for (let y = 2006; y < 2026; y++)
				for (let m = 1; m <= 12; m++)
					changes.push({
						accountId: `a${a}`,
						month: `${y}-${String(m).padStart(2, '0')}`,
						amount: 100
					});
		changes.push({ accountId: 'a0', month: '2199-12', amount: 1 });
		const start = performance.now();
		const series = accountBalanceSeries(changes, '2026-09');
		const elapsed = performance.now() - start;
		expect(series).toHaveLength((2199 - 2006) * 12 + 12);
		expect(series.at(-1)!.balances).toMatchObject({ a0: 24001, a1: 24000 });
		expect(elapsed).toBeLessThan(110);
	});
});
