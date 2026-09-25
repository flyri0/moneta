import { DomainError } from '$domain/errors';
import { isDate, isMonth } from '$domain/month';
import type { Db } from './connection';
import { getMeta, validateCurrency, validateLocale } from './repos/meta';

/**
 * Queries that find a row breaking a rule the repos keep on every write. A budget restored from a
 * file never went through the repos, so each must come back empty.
 */
const BROKEN_ROWS: [string, string][] = [
	[
		'an amount that is not an integer',
		"SELECT 1 FROM transactions WHERE typeof(amount) <> 'integer'"
	],
	[
		'a split amount that is not an integer',
		"SELECT 1 FROM transaction_splits WHERE typeof(amount) <> 'integer'"
	],
	[
		'an assignment that is not an integer',
		"SELECT 1 FROM budget_assignments WHERE typeof(assigned) <> 'integer'"
	],
	[
		'a schedule number that is not an integer',
		`SELECT 1 FROM schedules WHERE typeof(amount) <> 'integer' OR typeof(next_index) <> 'integer'
			OR typeof(interval) <> 'integer' OR typeof(end_count) NOT IN ('integer', 'null')`
	],
	[
		'a schedule split amount that is not an integer',
		"SELECT 1 FROM schedule_splits WHERE typeof(amount) <> 'integer'"
	],
	[
		'a split transaction without splits',
		`SELECT 1 FROM transactions t WHERE t.is_split = 1
			AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)`
	],
	[
		'splits on a transaction that is not split',
		`SELECT 1 FROM transaction_splits s JOIN transactions t ON t.id = s.transaction_id
			WHERE t.is_split = 0`
	],
	[
		'splits that do not add up to their transaction',
		`SELECT 1 FROM transactions t
			JOIN (SELECT transaction_id, SUM(amount) AS total FROM transaction_splits GROUP BY 1) s
				ON s.transaction_id = t.id
			WHERE s.total <> t.amount`
	],
	[
		'a split schedule without splits',
		`SELECT 1 FROM schedules t WHERE t.is_split = 1
			AND NOT EXISTS (SELECT 1 FROM schedule_splits s WHERE s.schedule_id = t.id)`
	],
	[
		'splits on a schedule that is not split',
		'SELECT 1 FROM schedule_splits s JOIN schedules t ON t.id = s.schedule_id WHERE t.is_split = 0'
	],
	[
		'splits that do not add up to their schedule',
		`SELECT 1 FROM schedules t
			JOIN (SELECT schedule_id, SUM(amount) AS total FROM schedule_splits GROUP BY 1) s
				ON s.schedule_id = t.id
			WHERE s.total <> t.amount`
	],
	[
		'a transfer without its other half',
		`SELECT 1 FROM transactions t LEFT JOIN transactions p ON p.id = t.transfer_id
			WHERE t.transfer_id IS NOT NULL
				AND (p.id IS NULL OR p.transfer_id IS NOT t.id OR p.amount <> -t.amount)`
	]
];

/** Text columns that hold dates (`isDate`) or months (`isMonth`). */
const DATES: [string, string, (value: string) => boolean][] = [
	['transactions', 'date', isDate],
	['schedules', 'start_date', isDate],
	['schedules', 'end_date', isDate],
	['budget_assignments', 'month', isMonth]
];

function damaged(what: string): DomainError {
	return new DomainError('BACKUP_DAMAGED', `The budget has ${what}`);
}

/**
 * Checks that a budget keeps the rules the app enforces when it writes: foreign keys, whole-number
 * amounts, real dates and months, splits that add up, paired transfers, and a meta the app can
 * display. Throws BACKUP_DAMAGED on the first one broken.
 */
export function checkInvariants(db: Db): void {
	if (db.selectArrays('PRAGMA foreign_key_check').length > 0) throw damaged('broken references');
	for (const [what, sql] of BROKEN_ROWS)
		if (db.selectArrays(`${sql} LIMIT 1`).length > 0) throw damaged(what);
	for (const [table, column, valid] of DATES) {
		const values = db.selectValues(
			`SELECT DISTINCT ${column} FROM ${table} WHERE ${column} IS NOT NULL`
		);
		for (const value of values)
			if (typeof value !== 'string' || !valid(value)) throw damaged(`a bad ${table}.${column}`);
	}
	const meta = getMeta(db);
	if (typeof meta.name !== 'string' || !meta.name.trim()) throw damaged('no name');
	try {
		validateCurrency(meta.currency);
		validateLocale(meta.locale);
	} catch {
		throw damaged(`an unknown currency or locale (${meta.currency}, ${meta.locale})`);
	}
}
