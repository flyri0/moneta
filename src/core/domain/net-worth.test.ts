import { describe, it, expect } from 'vitest';
import { netWorthSeries } from './net-worth';

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
