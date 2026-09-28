import { DomainError } from './errors';
import { addMonths, monthOf, type Month } from './month';

/**
 * When a credit card's bill closes and when it is due, as days of the month. A day past a month's
 * end falls on its last day.
 */
export interface BillingDays {
	closingDay: number;
	dueDay: number;
}

/** Throws INVALID_INPUT unless both are whole days from 1 to 31. */
export function validateBillingDays(days: BillingDays): void {
	for (const day of [days.closingDay, days.dueDay])
		if (!Number.isInteger(day) || day < 1 || day > 31)
			throw new DomainError('INVALID_INPUT', 'Billing days must be 1 to 31');
}

/** `day` of `month`, or the month's last day when it is shorter. */
function dayIn(month: Month, day: number): string {
	const [y, m] = month.split('-').map(Number);
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** Months from a bill's closing to its due date: 0 when the due day comes after the closing day. */
function dueOffset(days: BillingDays): number {
	return days.dueDay > days.closingDay ? 0 : 1;
}

/**
 * The closing date of the bill a purchase on `date` goes on. A purchase on the closing day goes on
 * the next bill.
 */
export function billClosingDate(days: BillingDays, date: string): string {
	const month = monthOf(date);
	const closing = dayIn(month, days.closingDay);
	return date < closing ? closing : dayIn(addMonths(month, 1), days.closingDay);
}

/** The due date of the bill closing on `closing`. */
export function billDueDate(days: BillingDays, closing: string): string {
	return dayIn(addMonths(monthOf(closing), dueOffset(days)), days.dueDay);
}

/** When installment `n` (0 is the first) of a purchase on `date` is due: on its own bill. */
export function installmentDueDate(days: BillingDays, date: string, n: number): string {
	const closingMonth = monthOf(billClosingDate(days, date));
	return dayIn(addMonths(closingMonth, n + dueOffset(days)), days.dueDay);
}
