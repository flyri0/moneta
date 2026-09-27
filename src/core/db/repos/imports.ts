import { DomainError } from '$domain/errors';
import { addDays } from '$domain/month';
import { all, one, run, tx, type Db } from '../connection';
import { createTransaction } from './transactions';

/** A line of a bank statement, ready to import. */
export interface StatementLine {
	date: string;
	/** Minor units, negative = outflow. */
	amount: number;
	description: string;
	memo: string;
	/** The id it is imported under ('ofx:…', 'csv:…'), unique in its account. */
	importId: string;
}

/**
 * What importing a line would do: `duplicate` when it was imported before (or repeats in the
 * file), `match` when it matches a transaction already entered by hand, else `new`.
 */
export type ImportStatus = 'new' | 'match' | 'duplicate';

export interface ImportPreview {
	status: ImportStatus;
	/** The transaction a `match` would mark imported and cleared. */
	match: { id: string; date: string; payeeName: string | null; memo: string } | null;
	/** The payee a `new` line would get: its description, trimmed. */
	payeeName: string;
	/** The category the payee usually gets, for on-budget accounts. */
	categoryId: string | null;
}

/** How far apart a statement line and a transaction entered by hand may be dated to match. */
export const MATCH_DAYS = 4;

interface Candidate {
	id: string;
	date: string;
	amount: number;
	payeeName: string | null;
	memo: string;
}

function dayDistance(a: string, b: string): number {
	return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function requireOpenAccount(db: Db, id: string): { onBudget: boolean } {
	const account = one<{ onBudget: number; closed: number }>(
		db,
		'SELECT on_budget AS onBudget, closed FROM accounts WHERE id = ?',
		[id]
	);
	if (!account) throw new DomainError('NOT_FOUND', `Account ${id} not found`);
	if (account.closed) throw new DomainError('ACCOUNT_CLOSED');
	return { onBudget: account.onBudget === 1 };
}

/** The payee's default category, else the one it last had, by payee name (case-insensitive). */
function suggestedCategories(db: Db): Map<string, string> {
	const rows = all<{ name: string; categoryId: string | null }>(
		db,
		`SELECT p.name, COALESCE(p.default_category_id,
			(SELECT t.category_id FROM transactions t
			 WHERE t.payee_id = p.id AND t.is_split = 0 AND t.transfer_id IS NULL
			   AND t.category_id IS NOT NULL
			 ORDER BY t.date DESC, t.id DESC LIMIT 1)) AS categoryId
		 FROM payees p`
	);
	const map = new Map<string, string>();
	for (const r of rows) if (r.categoryId) map.set(r.name.toLocaleLowerCase(), r.categoryId);
	return map;
}

/**
 * What importing `lines` into an account would do, line by line (see `ImportStatus`). A line
 * matches the closest-dated transaction with its amount, within `MATCH_DAYS`, that has no import
 * id; each transaction matches one line at most. Writes nothing.
 */
export function previewImport(db: Db, accountId: string, lines: StatementLine[]): ImportPreview[] {
	const { onBudget } = requireOpenAccount(db, accountId);
	if (lines.length === 0) return [];
	const imported = new Set(
		all<{ importId: string }>(
			db,
			'SELECT import_id AS importId FROM transactions WHERE account_id = ? AND import_id IS NOT NULL',
			[accountId]
		).map((r) => r.importId)
	);
	const dates = lines.map((l) => l.date).sort();
	const candidates = all<Candidate>(
		db,
		`SELECT t.id, t.date, t.amount, p.name AS payeeName, t.memo
		 FROM transactions t LEFT JOIN payees p ON p.id = t.payee_id
		 WHERE t.account_id = ? AND t.import_id IS NULL AND t.is_opening = 0
		   AND t.date BETWEEN ? AND ?
		 ORDER BY t.date, t.id`,
		[accountId, addDays(dates[0], -MATCH_DAYS), addDays(dates[dates.length - 1], MATCH_DAYS)]
	);
	const used = new Set<string>();
	const categories = onBudget ? suggestedCategories(db) : new Map<string, string>();

	return lines.map((line) => {
		const payeeName = line.description.trim();
		if (imported.has(line.importId)) {
			return { status: 'duplicate', match: null, payeeName, categoryId: null };
		}
		imported.add(line.importId);
		let best: Candidate | null = null;
		for (const c of candidates) {
			if (c.amount !== line.amount || used.has(c.id)) continue;
			const distance = dayDistance(c.date, line.date);
			if (distance > MATCH_DAYS) continue;
			if (!best || distance < dayDistance(best.date, line.date)) best = c;
		}
		if (best) {
			used.add(best.id);
			const { id, date, payeeName: matchPayee, memo } = best;
			return {
				status: 'match',
				match: { id, date, payeeName: matchPayee, memo },
				payeeName,
				categoryId: null
			};
		}
		return {
			status: 'new',
			match: null,
			payeeName,
			categoryId: categories.get(payeeName.toLocaleLowerCase()) ?? null
		};
	});
}

/** A line to import: created as a new transaction, or marking `matchId` imported and cleared. */
export interface ImportLine {
	importId: string;
	date: string;
	amount: number;
	payeeName: string;
	memo: string;
	categoryId: string | null;
	matchId: string | null;
}

export interface ImportInput {
	lines: ImportLine[];
	/** The CSV column mapping to remember for the account (JSON), when the file was a CSV. */
	csvFormat?: string | null;
}

export interface ImportResult {
	created: number;
	matched: number;
	/** Lines imported in the meantime, left out. */
	skipped: number;
}

/**
 * Imports statement lines into an account, all or nothing. New transactions come in cleared;
 * matched ones are marked cleared and keep everything else. A line whose import id is already in
 * the account is skipped.
 */
export function importTransactions(db: Db, accountId: string, input: ImportInput): ImportResult {
	return tx(db, () => {
		requireOpenAccount(db, accountId);
		const result: ImportResult = { created: 0, matched: 0, skipped: 0 };
		for (const line of input.lines) {
			if (typeof line.importId !== 'string' || !line.importId)
				throw new DomainError('INVALID_INPUT', 'Import id is required');
			const exists = one(
				db,
				'SELECT 1 AS x FROM transactions WHERE account_id = ? AND import_id = ?',
				[accountId, line.importId]
			);
			if (exists) {
				result.skipped++;
				continue;
			}
			if (line.matchId) {
				const target = one<{ importId: string | null }>(
					db,
					'SELECT import_id AS importId FROM transactions WHERE id = ? AND account_id = ?',
					[line.matchId, accountId]
				);
				if (!target || target.importId !== null)
					throw new DomainError('NOT_FOUND', `Transaction ${line.matchId} can't be matched`);
				run(db, 'UPDATE transactions SET import_id = ?, cleared = 1 WHERE id = ?', [
					line.importId,
					line.matchId
				]);
				result.matched++;
				continue;
			}
			const id = createTransaction(db, {
				accountId,
				date: line.date,
				amount: line.amount,
				payeeName: line.payeeName,
				categoryId: line.categoryId,
				memo: line.memo,
				cleared: true
			});
			run(db, 'UPDATE transactions SET import_id = ? WHERE id = ?', [line.importId, id]);
			result.created++;
		}
		if (input.csvFormat !== undefined)
			run(db, 'UPDATE accounts SET csv_format = ? WHERE id = ?', [input.csvFormat, accountId]);
		return result;
	});
}

/** The CSV column mapping last used to import into an account (JSON), if any. */
export function getCsvFormat(db: Db, accountId: string): string | null {
	const row = one<{ csvFormat: string | null }>(
		db,
		'SELECT csv_format AS csvFormat FROM accounts WHERE id = ?',
		[accountId]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Account ${accountId} not found`);
	return row.csvFormat;
}
