import { describe, it, expect } from 'vitest';
import {
	isFarFuture,
	isMonth,
	isDate,
	monthOf,
	addMonths,
	compareMonths,
	monthRange,
	todayIso,
	currentMonth,
	isBudgetMonth,
	lastBudgetMonth,
	MIN_DATE,
	MAX_DATE,
	daysBetween,
	addDays
} from './month';

describe('month helpers', () => {
	it('counts the days between two dates', () => {
		expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
		expect(daysBetween('2026-09-01', '2026-09-23')).toBe(22);
		expect(daysBetween('2026-02-20', '2026-03-02')).toBe(10);
		expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
		expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
		expect(daysBetween('2026-09-23', '2026-09-01')).toBe(-22);
	});

	it('validates months', () => {
		expect(isMonth('2026-09')).toBe(true);
		expect(isMonth('2026-13')).toBe(false);
		expect(isMonth('2026-9')).toBe(false);
	});

	it('only accepts months in the years 1900 to 2199', () => {
		expect(isMonth('1899-12')).toBe(false);
		expect(isMonth('1900-01')).toBe(true);
		expect(isMonth('2199-12')).toBe(true);
		expect(isMonth('2200-01')).toBe(false);
		expect(isMonth('9999-01')).toBe(false);
	});

	it('limits the budget screen to 25 years past the current one', () => {
		const now = new Date(2026, 8, 22);
		expect(lastBudgetMonth(now)).toBe('2051-12');
		expect(isBudgetMonth('2051-12', now)).toBe(true);
		expect(isBudgetMonth('2052-01', now)).toBe(false);
		expect(isBudgetMonth('2199-12', now)).toBe(false);
		expect(isBudgetMonth('1900-01', now)).toBe(true);
		expect(isBudgetMonth('2026-13', now)).toBe(false);
	});

	it('spans the whole allowed range with MIN_DATE and MAX_DATE', () => {
		expect(isDate(MIN_DATE)).toBe(true);
		expect(isDate(MAX_DATE)).toBe(true);
		expect(isDate('1899-12-31')).toBe(false);
		expect(isDate('2200-01-01')).toBe(false);
	});

	it('validates real calendar dates', () => {
		expect(isDate('2026-02-28')).toBe(true);
		expect(isDate('2026-02-29')).toBe(false);
		expect(isDate('2028-02-29')).toBe(true);
		expect(isDate('2026-9-01')).toBe(false);
	});

	it('only accepts dates in the years 1900 to 2199', () => {
		expect(isDate('1899-12-31')).toBe(false);
		expect(isDate('1900-01-01')).toBe(true);
		expect(isDate('2199-12-31')).toBe(true);
		expect(isDate('2200-01-01')).toBe(false);
	});

	it('extracts the month of a date', () => {
		expect(monthOf('2026-09-18')).toBe('2026-09');
	});

	it('adds months across year boundaries', () => {
		expect(addMonths('2026-12', 1)).toBe('2027-01');
		expect(addMonths('2026-01', -1)).toBe('2025-12');
		expect(addMonths('2026-05', 14)).toBe('2027-07');
		expect(addMonths('2026-05', 0)).toBe('2026-05');
	});

	it('compares months', () => {
		expect(compareMonths('2026-01', '2026-02')).toBe(-1);
		expect(compareMonths('2026-02', '2026-02')).toBe(0);
		expect(compareMonths('2027-01', '2026-12')).toBe(1);
	});

	it('builds inclusive month ranges', () => {
		expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
		expect(monthRange('2026-03', '2026-02')).toEqual([]);
	});

	it('formats today in local time', () => {
		const d = new Date(2026, 8, 5, 23, 30);
		expect(todayIso(d)).toBe('2026-09-05');
		expect(currentMonth(d)).toBe('2026-09');
	});
});

describe('addDays', () => {
	it('moves across months and years, both ways', () => {
		expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
	});
});

describe('isFarFuture', () => {
	it('flags dates more than two years after today', () => {
		expect(isFarFuture('2028-09-25', '2026-09-25')).toBe(false);
		expect(isFarFuture('2028-09-26', '2026-09-25')).toBe(true);
		expect(isFarFuture('2199-01-01', '2026-09-25')).toBe(true);
		expect(isFarFuture('2020-01-01', '2026-09-25')).toBe(false);
	});
});
