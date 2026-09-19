export type Month = string; // 'YYYY-MM'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isMonth(value: string): boolean {
	return MONTH_RE.test(value);
}

export function isDate(value: string): boolean {
	const m = DATE_RE.exec(value);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (y < 1900 || y > 2199) return false; // a typo year would make the engine walk far too many months
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

export function todayIso(now: Date = new Date()): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function currentMonth(now: Date = new Date()): Month {
	return monthOf(todayIso(now));
}
