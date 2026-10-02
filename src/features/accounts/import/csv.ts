import { dateTimeFormat } from '$domain/intl-cache';
import { isDate } from '$domain/month';
import { foldText } from '$domain/search';
import { detectDecimal, parseStatementAmount, type DecimalSeparator } from './amount';
import { cleanText, withImportIds, type ParsedLine } from './statement';
import type { StatementLine } from '$db/repos/imports';

/** The most columns in any row of `table` (a loop: spreading a long table overflows the stack). */
export function widest(table: string[][]): number {
	let columns = 0;
	for (const row of table) if (row.length > columns) columns = row.length;
	return columns;
}

/** The order of day, month and year in a CSV's dates. */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

/** How to read a bank's CSV: which column holds what, and how its dates and amounts look. */
export interface CsvFormat {
	/** Whether the first row names the columns. */
	header: boolean;
	date: number;
	description: number;
	memo: number | null;
	/** One signed amount column, or `inflow` and `outflow` columns. */
	amount: number | null;
	inflow: number | null;
	outflow: number | null;
	dateOrder: DateOrder;
	decimal: DecimalSeparator;
	/** Flips every amount, for card statements that list purchases as positive. */
	invert: boolean;
}

const DELIMITERS = [',', ';', '\t'] as const;

/** The delimiter used most in the first line, outside quotes. */
function detectDelimiter(text: string): string {
	const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
	const outside = first.replace(/"[^"]*"/g, '');
	let best: string = ',';
	let count = 0;
	for (const d of DELIMITERS) {
		const n = outside.split(d).length - 1;
		if (n > count) [best, count] = [d, n];
	}
	return best;
}

/** Splits CSV text into rows of fields (RFC 4180, with `,`, `;` or tab), dropping blank rows. */
export function parseCsv(text: string): string[][] {
	const delimiter = detectDelimiter(text);
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"' && field === '') quoted = true;
		else if (c === delimiter) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	row.push(field);
	rows.push(row);
	return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** A CSV date (`05/01/2026`, `2026-01-05`, `5.1.26`, with or without a time) as 'YYYY-MM-DD'. */
export function parseCsvDate(text: string, order: DateOrder): string | null {
	const m = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[ T].*)?$/.exec(text.trim());
	if (!m) return null;
	let [, a, b, c] = m;
	if (order === 'YMD') [a, c] = [c, a];
	else if (order === 'MDY') [a, b] = [b, a];
	// a = day, b = month, c = year.
	if (a.length > 2 || c.length === 3 || c.length === 1) return null;
	const year = c.length === 2 ? `20${c}` : c;
	const date = `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
	return isDate(date) ? date : null;
}

const ORDERS: DateOrder[] = ['DMY', 'MDY', 'YMD'];

/** The order `locale` writes dates in, for CSV dates that fit more than one. */
export function localeDateOrder(locale: string): DateOrder {
	const parts = dateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })
		.formatToParts(new Date(2026, 0, 31))
		.map((p) => p.type)
		.filter((t) => t === 'day' || t === 'month' || t === 'year');
	if (parts[0] === 'year') return 'YMD';
	return parts[0] === 'month' ? 'MDY' : 'DMY';
}

function isAnyDate(text: string): boolean {
	return ORDERS.some((o) => parseCsvDate(text, o) !== null);
}

/** The date order a column's values show, or `fallback` when they fit several. */
function detectDateOrder(values: string[], fallback: DateOrder): DateOrder {
	const fits = ORDERS.filter((o) => values.every((v) => parseCsvDate(v, o) !== null));
	return fits.includes(fallback) || fits.length === 0 ? fallback : fits[0];
}

/** Header names that say what a column holds, folded (lowercase, no accents). */
const NAMES: Record<'date' | 'description' | 'amount' | 'inflow' | 'outflow' | 'memo', RegExp> = {
	date: /^(data|date|dt)\b|data (do )?lancamento|posted/,
	description:
		/descri|historico|titulo|title|lancamento|estabelecimento|payee|favorecido|nome|name/,
	amount: /valor|amount|value|quantia|montante|total/,
	inflow: /credito|credit|entrada|inflow|deposit/,
	outflow: /debito|debit|saida|outflow|withdraw/,
	memo: /memo|obs|detalhe|details|note|complemento/
};

function share(rows: string[][], column: number, test: (v: string) => boolean): number {
	const values = rows.map((r) => r[column] ?? '').filter((v) => v.trim() !== '');
	return values.length === 0 ? 0 : values.filter(test).length / values.length;
}

/**
 * Guesses how to read a CSV table, from its header names when it has them and from its values
 * otherwise. The user checks the guess before importing.
 */
export function guessFormat(
	table: string[][],
	fallback: { decimal: DecimalSeparator; dateOrder: DateOrder }
): CsvFormat {
	const columns = widest(table);
	const first = table[0] ?? [];
	const header = first.length > 0 && !first.some((f) => isAnyDate(f));
	const data = (header ? table.slice(1) : table).slice(0, 50);
	const names = header ? first.map((f) => foldText(f.trim())) : [];
	const all = [...Array(columns).keys()];
	const named = (role: keyof typeof NAMES, except: (number | null)[] = []) =>
		all.find((i) => !except.includes(i) && NAMES[role].test(names[i] ?? '')) ?? null;
	const amountLike = (v: string) =>
		parseStatementAmount(v, ',', 2) !== null || parseStatementAmount(v, '.', 2) !== null;

	const date = named('date') ?? all.find((i) => share(data, i, isAnyDate) >= 0.8) ?? 0;
	let amount = named('amount', [date]);
	let inflow = amount === null ? named('inflow', [date]) : null;
	let outflow = amount === null ? named('outflow', [date, inflow]) : null;
	if (amount === null && (inflow === null || outflow === null)) {
		inflow = outflow = null;
		amount =
			all.find(
				(i) => i !== date && share(data, i, amountLike) >= 0.8 && share(data, i, isAnyDate) < 0.5
			) ?? null;
	}
	const used = [date, amount, inflow, outflow];
	const average = (i: number) =>
		data.reduce((sum, r) => sum + (r[i]?.trim().length ?? 0), 0) / Math.max(1, data.length);
	const description =
		named('description', used) ??
		all.filter((i) => !used.includes(i)).sort((a, b) => average(b) - average(a))[0] ??
		0;
	const memo = named('memo', [...used, description]);

	const amountValues = data.flatMap((r) =>
		[amount, inflow, outflow].flatMap((i) => (i === null ? [] : [r[i] ?? '']))
	);
	return {
		header,
		date,
		description,
		memo,
		amount,
		inflow,
		outflow,
		dateOrder: detectDateOrder(
			data.map((r) => r[date] ?? '').filter((v) => v.trim()),
			fallback.dateOrder
		),
		decimal: detectDecimal(amountValues, fallback.decimal),
		invert: false
	};
}

/** The lines of a CSV table read with `format`, and how many rows couldn't be read. */
export function applyFormat(
	table: string[][],
	format: CsvFormat,
	digits: number
): { lines: StatementLine[]; unreadable: number } {
	const rows = format.header ? table.slice(1) : table;
	const lines: ParsedLine[] = [];
	let unreadable = 0;
	const read = (text: string | undefined) =>
		text === undefined || text.trim() === ''
			? 0
			: parseStatementAmount(text, format.decimal, digits);
	for (const row of rows) {
		const date = parseCsvDate(row[format.date] ?? '', format.dateOrder);
		let amount: number | null;
		if (format.amount !== null) {
			const text = row[format.amount];
			amount = text?.trim() ? read(text) : null;
		} else {
			const inflow = format.inflow === null ? 0 : read(row[format.inflow]);
			const outflow = format.outflow === null ? 0 : read(row[format.outflow]);
			amount = inflow === null || outflow === null ? null : Math.abs(inflow) - Math.abs(outflow);
		}
		if (date === null || amount === null) {
			unreadable++;
			continue;
		}
		if (format.invert && amount !== 0) amount = -amount;
		const description = cleanText(row[format.description] ?? '');
		const memo = format.memo === null ? '' : cleanText(row[format.memo] ?? '');
		lines.push({ date, amount, description, memo });
	}
	return { lines: withImportIds(lines, 'csv'), unreadable };
}

/** A format saved for an account, if it still fits a table with `columns` columns. */
export function storedFormat(json: string | null, columns: number): CsvFormat | null {
	if (!json) return null;
	try {
		const f = JSON.parse(json) as CsvFormat;
		const indexes = [f.date, f.description, f.memo, f.amount, f.inflow, f.outflow];
		const fits = indexes.every((i) => i === null || (Number.isInteger(i) && i >= 0 && i < columns));
		const valid =
			fits &&
			typeof f.header === 'boolean' &&
			typeof f.invert === 'boolean' &&
			ORDERS.includes(f.dateOrder) &&
			(f.decimal === ',' || f.decimal === '.') &&
			(f.amount !== null || f.inflow !== null || f.outflow !== null);
		return valid ? f : null;
	} catch {
		return null;
	}
}
