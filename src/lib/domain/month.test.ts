import { describe, it, expect } from 'vitest';
import {
	isMonth,
	isDate,
	monthOf,
	addMonths,
	compareMonths,
	monthRange,
	todayIso,
	currentMonth
} from './month';

describe('month helpers', () => {
	it('validates months', () => {
		expect(isMonth('2026-09')).toBe(true);
		expect(isMonth('2026-13')).toBe(false);
		expect(isMonth('2026-9')).toBe(false);
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
