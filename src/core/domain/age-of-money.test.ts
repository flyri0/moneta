import { describe, it, expect } from 'vitest';
import { ageOfMoneySeries, type CashFlowEntry } from './age-of-money';

let seq = 0;
function flow(date: string, amount: number, opening = false): CashFlowEntry {
	seq += 1;
	return { date, id: String(seq).padStart(6, '0'), amount, opening };
}

function spends(date: string, count: number, amount: number): CashFlowEntry[] {
	return Array.from({ length: count }, () => flow(date, -amount));
}

describe('ageOfMoneySeries', () => {
	it('dates each outflow by the oldest money still unspent', () => {
		const series = ageOfMoneySeries(
			[flow('2026-01-01', 100000), ...spends('2026-01-11', 10, 5000)],
			'2026-01-31'
		);
		expect(series).toEqual([{ month: '2026-01', days: 10 }]);
	});

	it('weights an outflow that drains two inflows by how much it took from each', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', 10000),
				flow('2026-01-21', 100000),
				flow('2026-01-31', -20000), // 30 days on half, 10 on the other half: 20
				...spends('2026-01-31', 9, 1000) // 10 days each
			],
			'2026-01-31'
		);
		expect(series).toEqual([{ month: '2026-01', days: 11 }]); // (20 + 9 × 10) / 10
	});

	it('has no value until there are ten outflows', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', 100000),
				...spends('2026-01-11', 9, 5000),
				...spends('2026-02-11', 1, 5000)
			],
			'2026-02-28'
		);
		expect(series).toEqual([
			{ month: '2026-01', days: null },
			{ month: '2026-02', days: 13 } // (9 × 10 + 41) / 10 = 13.1
		]);
	});

	it('averages only the last ten outflows', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', 100000),
				...spends('2026-01-06', 10, 1000),
				...spends('2026-02-05', 10, 1000)
			],
			'2026-02-28'
		);
		expect(series).toEqual([
			{ month: '2026-01', days: 5 },
			{ month: '2026-02', days: 35 }
		]);
	});

	it('carries the last value through months without outflows, up to today', () => {
		const series = ageOfMoneySeries(
			[flow('2026-01-01', 100000), ...spends('2026-01-11', 10, 1000)],
			'2026-03-15'
		);
		expect(series.map((p) => p.days)).toEqual([10, 10, 10]);
		expect(series.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03']);
	});

	it('leaves out anything dated after today', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', 100000),
				...spends('2026-01-11', 10, 1000),
				...spends('2026-04-01', 10, 1000)
			],
			'2026-02-10'
		);
		expect(series).toEqual([
			{ month: '2026-01', days: 10 },
			{ month: '2026-02', days: 10 }
		]);
	});

	it('orders the entries by date whatever order they come in', () => {
		const series = ageOfMoneySeries(
			[...spends('2026-01-11', 10, 1000), flow('2026-01-01', 100000)],
			'2026-01-31'
		);
		expect(series).toEqual([{ month: '2026-01', days: 10 }]);
	});

	it('counts money spent before it came in as zero days old', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', 10000),
				...spends('2026-01-11', 10, 2000), // five covered at 10 days, five not at all
				flow('2026-02-01', 10000), // pays back the shortfall, so nothing is left over
				...spends('2026-02-11', 10, 1000)
			],
			'2026-02-28'
		);
		expect(series).toEqual([
			{ month: '2026-01', days: 5 },
			{ month: '2026-02', days: 0 }
		]);
	});

	it('does not count a negative starting balance as an outflow', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', -50000, true),
				flow('2026-01-05', 100000),
				...spends('2026-01-15', 9, 1000)
			],
			'2026-01-31'
		);
		expect(series).toEqual([{ month: '2026-01', days: null }]);
	});

	it('pays a negative starting balance back before the next inflow can be spent', () => {
		const series = ageOfMoneySeries(
			[
				flow('2026-01-01', -50000, true),
				flow('2026-01-05', 50000),
				flow('2026-01-10', 100000),
				...spends('2026-01-20', 10, 5000)
			],
			'2026-01-31'
		);
		expect(series).toEqual([{ month: '2026-01', days: 10 }]);
	});

	it('is empty without entries', () => {
		expect(ageOfMoneySeries([], '2026-01-31')).toEqual([]);
	});
});
