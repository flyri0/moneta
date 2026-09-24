export type Month = string; // 'YYYY-MM'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A typo year (e.g. 9999) would make the budget engine walk far too many months.
const MIN_YEAR = 1900;
const MAX_YEAR = 2199;

/** The lowest and highest dates the year clamp allows, for "all time" ranges. */
export const MIN_DATE = `${MIN_YEAR}-01-01`;
export const MAX_DATE = `${MAX_YEAR}-12-31`;

function inYearRange(year: number): boolean {
	return year >= MIN_YEAR && year <= MAX_YEAR;
}

export function isMonth(value: string): boolean {
	return MONTH_RE.test(value) && inYearRange(Number(value.slice(0, 4)));
}

export function isDate(value: string): boolean {
	const m = DATE_RE.exec(value);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (!inYearRange(y)) return false;
	const date = new Date(Date.UTC(y, mo - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function monthOf(date: string): Month {
	return date.slice(0, 7);
}

export function addMonths(month: Month, n: number): Month {
	const [y, m] = month.split('-').map(Number);
	const index = y * 12 + (m - 1) + n;
	const year = Math.floor(index / 12);
	const mon = (index % 12) + 1;
	return `${String(year).padStart(4, '0')}-${String(mon).padStart(2, '0')}`;
}

export function compareMonths(a: Month, b: Month): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function monthRange(from: Month, to: Month): Month[] {
	const out: Month[] = [];
	for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
	return out;
}

function dayNumber(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` comes first. */
export function daysBetween(from: string, to: string): number {
	return dayNumber(to) - dayNumber(from);
}

/** `date` (YYYY-MM-DD) moved by `days`, negative going back. */
export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const t = new Date(Date.UTC(y, m - 1, d + days));
	const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(t.getUTCDate()).padStart(2, '0');
	return `${String(t.getUTCFullYear()).padStart(4, '0')}-${mm}-${dd}`;
}

export function todayIso(now: Date = new Date()): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function currentMonth(now: Date = new Date()): Month {
	return monthOf(todayIso(now));
}

/** How many years past the current one the budget screen can show. */
export const BUDGET_YEARS_AHEAD = 25;

/**
 * The last month the budget screen shows. The engine walks every month up to the one on screen,
 * so the route stays well short of MAX_DATE.
 */
export function lastBudgetMonth(now: Date = new Date()): Month {
	return `${now.getFullYear() + BUDGET_YEARS_AHEAD}-12`;
}

/** Whether `value` is a month the budget screen can show. */
export function isBudgetMonth(value: string, now: Date = new Date()): boolean {
	return isMonth(value) && value <= lastBudgetMonth(now);
}
