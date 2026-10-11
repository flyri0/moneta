import { describe, it, expect } from 'vitest';
import type { UpcomingOccurrence } from '$db/repos/schedules';
import { collapseOverdue } from './upcoming';

const occurrence = (scheduleId: string, index: number, due: boolean): UpcomingOccurrence =>
	({
		scheduleId,
		index,
		due,
		date: `2026-01-${String(index + 1).padStart(2, '0')}`
	}) as UpcomingOccurrence;

describe('collapseOverdue', () => {
	it("keeps each schedule's first overdue occurrence and counts the rest", () => {
		const list = [
			occurrence('a', 0, true),
			occurrence('b', 0, true),
			occurrence('a', 1, true),
			occurrence('a', 2, true),
			occurrence('b', 1, false),
			occurrence('a', 3, false)
		];
		expect(
			collapseOverdue(list).map(({ occurrence: o, position, moreOverdue }) => [
				o.scheduleId,
				o.index,
				position,
				moreOverdue
			])
		).toEqual([
			['b', 0, 1, 0],
			['a', 0, 3, 2],
			['b', 1, 4, 0],
			['a', 3, 5, 0]
		]);
	});

	it('places a collapsed row where its last occurrence is, so its balance counts them all', () => {
		const list = [
			occurrence('rent', 0, true),
			occurrence('rent', 1, true),
			occurrence('pay', 0, false)
		];
		expect(collapseOverdue(list).map((r) => [r.occurrence.scheduleId, r.position])).toEqual([
			['rent', 1],
			['pay', 2]
		]);
	});
});
