import { currencyDigits } from '$domain/money';
import type { Db } from './connection';
import { dumpBudget } from './repos/dump';
import { getMeta } from './repos/meta';
import { listTransactions, type TransactionRow } from './repos/transactions';

/** Byte-order mark: tells spreadsheets the file is UTF-8. */
const BOM = '\uFEFF';
const HEADER = ['Date', 'Account', 'Payee', 'Transfer', 'Category', 'Memo', 'Amount', 'Cleared'];

/** Minor units as a plain decimal with a dot, e.g. -123456 → "-1234.56" (2 digits). */
export function minorToDecimal(minor: number, digits: number): string {
	const sign = minor < 0 ? '-' : '';
	const abs = String(Math.abs(minor)).padStart(digits + 1, '0');
	if (digits === 0) return sign + abs;
	return `${sign}${abs.slice(0, -digits)}.${abs.slice(-digits)}`;
}

/** Quotes a field when needed (RFC 4180). */
function field(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A text field that spreadsheets must not run as a formula (OWASP "CSV injection"). */
function text(value: string | null): string {
	const v = value ?? '';
	return field(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
}

/**
 * Transactions (given oldest first) as CSV for spreadsheets: one row per transaction, and one per
 * line of a split transaction. Amounts are plain decimals (negative = outflow), dates ISO, and
 * names as stored. Starts with a byte-order mark so spreadsheets read it as UTF-8.
 */
export function transactionsCsv(rows: TransactionRow[], currency: string): string {
	const digits = currencyDigits(currency);
	const lines = [HEADER.join(',')];
	for (const t of rows) {
		const parts = t.isSplit
			? t.splits.map((s) => ({
					category: s.categoryName,
					memo: s.memo || t.memo,
					amount: s.amount
				}))
			: [{ category: t.categoryName, memo: t.memo, amount: t.amount }];
		for (const p of parts) {
			lines.push(
				[
					t.date,
					text(t.accountName),
					text(t.payeeName),
					text(t.transferAccountName),
					text(p.category),
					text(p.memo),
					minorToDecimal(p.amount, digits),
					t.cleared ? 'cleared' : 'uncleared'
				].join(',')
			);
		}
	}
	return `${BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * Every transaction of the budget as a CSV file, oldest first. Built here in the worker, so the
 * page receives only the bytes.
 */
export function exportCsv(db: Db): Uint8Array<ArrayBuffer> {
	// listTransactions gives newest first (date, then id, descending).
	const rows = listTransactions(db).reverse();
	return new TextEncoder().encode(transactionsCsv(rows, getMeta(db).currency));
}

/** The whole budget (`dumpBudget`) as a JSON file. */
export function exportJson(db: Db, now: Date = new Date()): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(`${JSON.stringify(dumpBudget(db, now))}\n`);
}
