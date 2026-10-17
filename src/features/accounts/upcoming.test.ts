import { describe, it, expect } from 'vite-plus/test';
import type { UpcomingOccurrence } from '$db/repos/schedules';
import { collapseOverdue } from './upcoming';

const occurrence = (
	scheduleId: string,
	index: number,
	due: boolean,
	amount: number
): UpcomingOccurrence =>
	({
		scheduleId,
		index,
		due,
		amount,
		date: `2026-01-${String(index + 1).padStart(2, '0')}`
	}) as UpcomingOccurrence;

describe('collapseOverdue', () => {
	it('counts all collapsed amounts before projecting the next displayed row', () => {
		const list = [
			occurrence('a', 0, true, -100),
			occurrence('b', 0, true, -200),
			occurrence('a', 1, true, -150),
			occurrence('a', 2, false, -100)
		];
		expect(
			collapseOverdue(list, 1000).map((r) => [
				r.occurrence.scheduleId,
				r.occurrence.index,
				r.moreOverdue,
				r.amount,
				r.balance
			])
		).toEqual([
			['a', 0, 1, -250, 750],
			['b', 0, 0, -200, 550],
			['a', 2, 0, -100, 450]
		]);
		expect(list.map((o) => o.amount)).toEqual([-100, -200, -150, -100]);
	});

	it('keeps inflows and uncollapsed occurrences in the displayed projection', () => {
		const list = [
			occurrence('pay', 0, true, 300),
			occurrence('rent', 0, true, -200),
			occurrence('pay', 1, true, 400),
			occurrence('rent', 1, false, -200)
		];
		expect(collapseOverdue(list, -100).map((r) => [r.amount, r.balance])).toEqual([
			[700, 600],
			[-200, 400],
			[-200, 200]
		]);
		expect(collapseOverdue([], 1000)).toEqual([]);
	});
});
