import { describe, it, expect } from 'vitest';
import {
	billClosingDate,
	billDueDate,
	installmentDueDate,
	validateBillingDays,
	type BillingDays
} from './card-bill';

const days = (closingDay: number, dueDay: number): BillingDays => ({ closingDay, dueDay });

describe('validateBillingDays', () => {
	it('accepts whole days from 1 to 31', () => {
		expect(() => validateBillingDays(days(1, 31))).not.toThrow();
	});

	it('refuses anything else', () => {
		for (const bad of [days(0, 10), days(5, 32), days(5.5, 10), days(5, NaN)])
			expect(() => validateBillingDays(bad)).toThrow(/INVALID_INPUT|day/i);
	});
});

describe('billClosingDate', () => {
	it('puts a purchase before the closing day on this month’s bill', () => {
		expect(billClosingDate(days(5, 15), '2026-10-04')).toBe('2026-10-05');
	});

	it('puts a purchase on or after the closing day on the next bill', () => {
		expect(billClosingDate(days(5, 15), '2026-10-05')).toBe('2026-11-05');
		expect(billClosingDate(days(5, 15), '2026-09-29')).toBe('2026-10-05');
	});

	it('closes on the last day of a shorter month', () => {
		expect(billClosingDate(days(31, 10), '2027-02-10')).toBe('2027-02-28');
		expect(billClosingDate(days(31, 10), '2027-02-28')).toBe('2027-03-31');
	});

	it('rolls over the year', () => {
		expect(billClosingDate(days(20, 28), '2026-12-25')).toBe('2027-01-20');
	});
});

describe('billDueDate', () => {
	it('is due the same month when the due day comes after the closing day', () => {
		expect(billDueDate(days(5, 15), '2026-10-05')).toBe('2026-10-15');
	});

	it('is due the next month when the due day comes first', () => {
		expect(billDueDate(days(25, 5), '2026-10-25')).toBe('2026-11-05');
		expect(billDueDate(days(10, 10), '2026-12-10')).toBe('2027-01-10');
	});

	it('is due on the last day of a shorter month', () => {
		expect(billDueDate(days(20, 31), '2026-09-20')).toBe('2026-09-30');
		expect(billDueDate(days(1, 30), '2027-02-01')).toBe('2027-02-28');
	});
});

describe('installmentDueDate', () => {
	it('puts each installment on its bill’s due date', () => {
		const at = (n: number) => installmentDueDate(days(5, 15), '2026-09-29', n);
		expect([at(0), at(1), at(2)]).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
	});

	it('counts from the next bill for a purchase on the closing day', () => {
		expect(installmentDueDate(days(5, 15), '2026-10-05', 0)).toBe('2026-11-15');
	});

	it('keeps the due day after a shorter month', () => {
		const at = (n: number) => installmentDueDate(days(20, 31), '2027-01-10', n);
		expect([at(0), at(1), at(2)]).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
	});

	it('crosses into the next year', () => {
		expect(installmentDueDate(days(25, 5), '2026-11-30', 1)).toBe('2027-02-05');
	});
});
