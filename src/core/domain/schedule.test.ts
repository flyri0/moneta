import { describe, it, expect } from 'vitest';
import {
	resumeDate,
	occurrenceDate,
	occurrencesBetween,
	scheduledDate,
	validateRule,
	type Rule
} from './schedule';

const rule = (over: Partial<Rule> = {}): Rule => ({
	startDate: '2026-01-31',
	frequency: 'monthly',
	interval: 1,
	endDate: null,
	endCount: null,
	weekend: 'keep',
	...over
});

const dates = (r: Rule, count: number) =>
	Array.from({ length: count }, (_, n) => occurrenceDate(r, n));

describe('occurrenceDate', () => {
	it('steps monthly from the start date and clamps to short months', () => {
		expect(dates(rule(), 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
	});

	it('knows leap years', () => {
		expect(dates(rule({ startDate: '2028-01-31' }), 2)).toEqual(['2028-01-31', '2028-02-29']);
		expect(dates(rule({ startDate: '2028-02-29', frequency: 'yearly' }), 2)).toEqual([
			'2028-02-29',
			'2029-02-28'
		]);
	});

	it('multiplies the interval for every frequency', () => {
		expect(dates(rule({ startDate: '2026-09-01', frequency: 'daily', interval: 3 }), 3)).toEqual([
			'2026-09-01',
			'2026-09-04',
			'2026-09-07'
		]);
		expect(dates(rule({ startDate: '2026-09-04', frequency: 'weekly', interval: 2 }), 3)).toEqual([
			'2026-09-04',
			'2026-09-18',
			'2026-10-02'
		]);
		expect(dates(rule({ startDate: '2026-11-15', interval: 3 }), 3)).toEqual([
			'2026-11-15',
			'2027-02-15',
			'2027-05-15'
		]);
	});

	it('moves weekend dates to the Friday before or the Monday after, across month edges', () => {
		// 2026-08-01 is a Saturday and 2026-11-01 a Sunday.
		expect(dates(rule({ startDate: '2026-08-01', weekend: 'before' }), 4)).toEqual([
			'2026-07-31',
			'2026-09-01',
			'2026-10-01',
			'2026-10-30'
		]);
		expect(dates(rule({ startDate: '2026-08-01', weekend: 'after' }), 4)).toEqual([
			'2026-08-03',
			'2026-09-01',
			'2026-10-01',
			'2026-11-02'
		]);
	});

	it('ignores the weekend rule for daily schedules', () => {
		expect(
			dates(rule({ startDate: '2026-08-01', frequency: 'daily', weekend: 'before' }), 2)
		).toEqual(['2026-08-01', '2026-08-02']);
	});

	it('ends by date (before the weekend move) or by count', () => {
		expect(dates(rule({ startDate: '2026-01-15', endDate: '2026-03-15' }), 4)).toEqual([
			'2026-01-15',
			'2026-02-15',
			'2026-03-15',
			null
		]);
		// 2026-06-06 is a Saturday: it is on the end date, so it still happens, on Monday.
		expect(
			dates(rule({ startDate: '2026-06-06', endDate: '2026-06-06', weekend: 'after' }), 2)
		).toEqual(['2026-06-08', null]);
		expect(dates(rule({ startDate: '2026-01-15', endCount: 2 }), 3)).toEqual([
			'2026-01-15',
			'2026-02-15',
			null
		]);
	});

	it('happens once for a one-time schedule', () => {
		expect(dates(rule({ startDate: '2026-09-24', frequency: 'once' }), 2)).toEqual([
			'2026-09-24',
			null
		]);
	});

	it('has no occurrence before the first or past the supported years', () => {
		expect(occurrenceDate(rule(), -1)).toBeNull();
		expect(occurrenceDate(rule({ startDate: '2199-06-01', frequency: 'yearly' }), 1)).toBeNull();
	});
});

describe('scheduledDate', () => {
	it('is the date before the weekend move', () => {
		const r = rule({ startDate: '2026-08-01', weekend: 'before' });
		expect(scheduledDate(r, 0)).toBe('2026-08-01');
		expect(occurrenceDate(r, 0)).toBe('2026-07-31');
	});
});

describe('resumeDate', () => {
	it('is where the rule would go on at an index, past its end', () => {
		expect(resumeDate(rule({ startDate: '2026-01-15', endCount: 2 }), 2)).toBe('2026-03-15');
		expect(resumeDate(rule({ startDate: '2026-01-31' }), 1)).toBe('2026-02-28');
	});

	it('is the own date of a one-time schedule', () => {
		expect(resumeDate(rule({ startDate: '2026-09-01', frequency: 'once' }), 1)).toBe('2026-09-01');
	});
});

describe('occurrencesBetween', () => {
	it('lists occurrences from an index up to a date', () => {
		expect(occurrencesBetween(rule(), 1, '2026-04-30')).toEqual([
			{ index: 1, date: '2026-02-28' },
			{ index: 2, date: '2026-03-31' },
			{ index: 3, date: '2026-04-30' }
		]);
		expect(occurrencesBetween(rule(), 0, '2026-01-30')).toEqual([]);
	});
});

describe('validateRule', () => {
	const invalid = expect.objectContaining({ code: 'INVALID_INPUT' });

	it('accepts a sound rule', () => {
		expect(() => validateRule(rule({ endCount: 3 }))).not.toThrow();
	});

	it('rejects bad dates, intervals, counts and names', () => {
		expect(() => validateRule(rule({ startDate: '2026-02-30' }))).toThrow(invalid);
		expect(() => validateRule(rule({ interval: 0 }))).toThrow(invalid);
		expect(() => validateRule(rule({ interval: 1.5 }))).toThrow(invalid);
		expect(() => validateRule(rule({ endDate: '2026-01-30' }))).toThrow(invalid);
		expect(() => validateRule(rule({ endCount: 0 }))).toThrow(invalid);
		expect(() => validateRule(rule({ frequency: 'hourly' as Rule['frequency'] }))).toThrow(invalid);
		expect(() => validateRule(rule({ weekend: 'never' as Rule['weekend'] }))).toThrow(invalid);
	});
});
