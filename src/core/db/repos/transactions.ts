import { uuidv7 } from 'uuidv7';
import { DomainError } from '$domain/errors';
import { validateFlag, validateFlagFilter, type FlagColor, type FlagFilter } from '$domain/flag';
import { groupBy } from '$domain/group-by';
import { isDate } from '$domain/month';
import { foldText, searchTerms, type SearchTerm } from '$domain/search';
import { all, one, run, tx, type Db } from '../connection';
import { memo as perVersion } from '../memo';
import { getMeta } from './meta';
import { getOrCreatePayee } from './payees';

export interface SplitInput {
	categoryId: string;
	amount: number;
	memo?: string;
}

export interface TransactionInput {
	accountId: string;
	date: string; // YYYY-MM-DD
	amount: number; // minor units, negative = outflow
	payeeName?: string | null;
	categoryId?: string | null; // for transfers: category of the on-budget leg (only when budgets differ)
	memo?: string;
	cleared?: boolean;
	splits?: SplitInput[];
	transferAccountId?: string | null;
	/** Only on this side of a transfer: the other keeps its own. */
	flag?: FlagColor | null;
}

export interface SplitRow {
	id: string;
	categoryId: string;
	categoryName: string;
	amount: number;
	memo: string;
}

export interface TransactionRow {
	id: string;
	accountId: string;
	accountName: string;
	date: string;
	amount: number;
	payeeId: string | null;
	payeeName: string | null;
	categoryId: string | null;
	categoryName: string | null;
	memo: string;
	cleared: boolean;
	transferId: string | null;
	transferAccountId: string | null;
	transferAccountName: string | null;
	isSplit: boolean;
	/** An account's starting balance, which reports leave out of income and spending. */
	isOpening: boolean;
	/** Cleared and checked against the bank's balance when the account was reconciled. */
	reconciled: boolean;
	flag: FlagColor | null;
	splits: SplitRow[];
}

export interface TransactionQuery {
	accountId?: string;
	categoryId?: string; // the transaction's category or one of its split lines'
	payeeId?: string;
	search?: string;
	from?: string;
	to?: string;
	/** Bounds on the size of the amount, in minor units, ignoring its sign. */
	amountMin?: number;
	amountMax?: number;
	cleared?: boolean;
	/** The flags to keep, `'none'` for transactions without one. */
	flags?: FlagFilter;
	limit?: number;
	offset?: number;
}

interface AccountInfo {
	id: string;
	type: string;
	onBudget: number;
	closed: number;
}

function getAccountInfo(db: Db, id: string): AccountInfo {
	const row = one<AccountInfo>(
		db,
		'SELECT id, type, on_budget AS onBudget, closed FROM accounts WHERE id = ?',
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Account ${id} not found`);
	return row;
}

/** Validates that the category exists. */
function checkUsableCategory(db: Db, id: string): void {
	const row = one<{ id: string }>(db, 'SELECT id FROM categories WHERE id = ?', [id]);
	if (!row) throw new DomainError('NOT_FOUND', `Category ${id} not found`);
}

interface Plan {
	mainCategoryId: string | null;
	pair: { accountId: string; categoryId: string | null } | null;
	splits: SplitInput[];
}

function validate(db: Db, input: TransactionInput): Plan {
	const account = getAccountInfo(db, input.accountId);
	if (account.closed) throw new DomainError('ACCOUNT_CLOSED');
	if (!Number.isSafeInteger(input.amount))
		throw new DomainError('INVALID_INPUT', 'Amount must be an integer');
	if (!isDate(input.date)) throw new DomainError('INVALID_INPUT', `Invalid date ${input.date}`);
	validateFlag(input.flag);
	const splits = input.splits ?? [];
	const categoryId = input.categoryId ?? null;

	if (input.transferAccountId) {
		if (splits.length > 0) throw new DomainError('TRANSFER_INVALID', 'Transfers cannot be split');
		if (input.transferAccountId === input.accountId)
			throw new DomainError('TRANSFER_INVALID', 'Cannot transfer to the same account');
		const other = getAccountInfo(db, input.transferAccountId);
		if (other.closed) throw new DomainError('ACCOUNT_CLOSED');
		if (account.onBudget === other.onBudget) {
			if (categoryId)
				throw new DomainError('CATEGORY_NOT_ALLOWED', 'Budget-neutral transfers have no category');
			return { mainCategoryId: null, pair: { accountId: other.id, categoryId: null }, splits: [] };
		}
		if (!categoryId) throw new DomainError('CATEGORY_REQUIRED');
		checkUsableCategory(db, categoryId);
		return account.onBudget
			? { mainCategoryId: categoryId, pair: { accountId: other.id, categoryId: null }, splits: [] }
			: { mainCategoryId: null, pair: { accountId: other.id, categoryId }, splits: [] };
	}

	if (!account.onBudget) {
		if (categoryId || splits.length > 0)
			throw new DomainError('CATEGORY_NOT_ALLOWED', 'Off-budget transactions have no category');
		return { mainCategoryId: null, pair: null, splits: [] };
	}

	if (splits.length > 0) {
		if (categoryId) throw new DomainError('INVALID_INPUT', 'Split transactions have no category');
		if (splits.length < 2) throw new DomainError('SPLIT_TOO_FEW_LINES');
		let sum = 0;
		for (const s of splits) {
			if (!Number.isSafeInteger(s.amount))
				throw new DomainError('INVALID_INPUT', 'Amount must be an integer');
			checkUsableCategory(db, s.categoryId);
			sum += s.amount;
		}
		if (sum !== input.amount)
			throw new DomainError('SPLIT_SUM_MISMATCH', undefined, {
				expected: input.amount,
				actual: sum
			});
		return { mainCategoryId: null, pair: null, splits };
	}

	if (!categoryId) throw new DomainError('CATEGORY_REQUIRED');
	checkUsableCategory(db, categoryId);
	return { mainCategoryId: categoryId, pair: null, splits: [] };
}

/** Checks a transaction against the domain rules without writing it. */
export function validateTransaction(db: Db, input: TransactionInput): void {
	validate(db, input);
}

const INSERT_SQL = `INSERT INTO transactions
	(id, account_id, date, amount, payee_id, category_id, memo, cleared, transfer_id, is_split,
	 is_opening, import_id, reconciled, flag)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** What an edit keeps of a row it rewrites, as long as the row stays in the same account. */
interface KeptState {
	accountId: string;
	cleared: boolean;
	importId: string | null;
	reconciled: boolean;
	flag: FlagColor | null;
}

/** The import id and reconciliation `kept` passes on to a row written in `accountId`. */
function carried(kept: KeptState | undefined, accountId: string) {
	const same = kept?.accountId === accountId;
	return { importId: same ? kept.importId : null, reconciled: same && kept.reconciled };
}

function write(
	db: Db,
	id: string,
	input: TransactionInput,
	kept?: { own: KeptState; pair: (KeptState & { id: string }) | null },
	opening = false
): void {
	const plan = validate(db, input);
	const memo = input.memo ?? '';
	const payeeId = plan.pair ? null : getOrCreatePayee(db, input.payeeName);
	const pairState = kept?.pair;
	const reusePair = pairState && plan.pair && pairState.accountId === plan.pair.accountId;
	const pairId = plan.pair ? (reusePair ? pairState.id : uuidv7()) : null;
	const own = carried(kept?.own, input.accountId);
	if (own.reconciled && !input.cleared) throw new DomainError('TRANSACTION_RECONCILED');

	run(db, INSERT_SQL, [
		id,
		input.accountId,
		input.date,
		input.amount,
		payeeId,
		plan.mainCategoryId,
		memo,
		input.cleared ? 1 : 0,
		pairId,
		plan.splits.length > 0 ? 1 : 0,
		opening ? 1 : 0,
		own.importId,
		own.reconciled ? 1 : 0,
		input.flag ?? null
	]);
	if (plan.pair && pairId) {
		const pair = carried(reusePair ? pairState : undefined, plan.pair.accountId);
		run(db, INSERT_SQL, [
			pairId,
			plan.pair.accountId,
			input.date,
			-input.amount,
			null,
			plan.pair.categoryId,
			memo,
			reusePair && pairState.cleared ? 1 : 0,
			id,
			0,
			0,
			pair.importId,
			pair.reconciled ? 1 : 0,
			reusePair ? pairState.flag : null
		]);
	}
	for (const s of plan.splits) {
		run(
			db,
			'INSERT INTO transaction_splits (id, transaction_id, category_id, amount, memo) VALUES (?, ?, ?, ?, ?)',
			[uuidv7(), id, s.categoryId, s.amount, s.memo ?? '']
		);
	}
}

interface RawRow {
	id: string;
	accountId: string;
	transferId: string | null;
	cleared: number;
	isOpening: number;
	importId: string | null;
	reconciled: number;
	flag: FlagColor | null;
}

function getRaw(db: Db, id: string): RawRow {
	const row = one<RawRow>(
		db,
		`SELECT id, account_id AS accountId, transfer_id AS transferId, cleared, is_opening AS isOpening,
			import_id AS importId, reconciled, flag
		 FROM transactions WHERE id = ?`,
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Transaction ${id} not found`);
	return row;
}

/** Loads an existing transaction for a change, refusing if it or its transfer pair sits in a closed account. */
function getEditable(db: Db, id: string): { existing: RawRow; pair: RawRow | null } {
	const existing = getRaw(db, id);
	const pair = existing.transferId ? getRaw(db, existing.transferId) : null;
	for (const row of pair ? [existing, pair] : [existing]) {
		if (getAccountInfo(db, row.accountId).closed) throw new DomainError('ACCOUNT_CLOSED');
	}
	return { existing, pair };
}

export function createTransaction(db: Db, input: TransactionInput): string {
	return tx(db, () => {
		const id = uuidv7();
		write(db, id, input);
		return id;
	});
}

/** Creates an account's starting balance, which reports leave out of income and spending. */
export function createStartingBalance(db: Db, input: TransactionInput): string {
	return tx(db, () => {
		const id = uuidv7();
		write(db, id, input, undefined, true);
		return id;
	});
}

function keptState(row: RawRow): KeptState & { id: string } {
	return {
		id: row.id,
		accountId: row.accountId,
		cleared: row.cleared === 1,
		importId: row.importId,
		reconciled: row.reconciled === 1,
		flag: row.flag
	};
}

/**
 * Replaces a transaction (and its transfer pair / splits) while keeping its id. A row that stays
 * in its account keeps its import id and reconciliation; a reconciled one must stay cleared.
 */
export function updateTransaction(db: Db, id: string, input: TransactionInput): void {
	tx(db, () => {
		const { existing, pair } = getEditable(db, id);
		run(db, 'DELETE FROM transactions WHERE id IN (?, ?)', [id, existing.transferId]);
		write(
			db,
			id,
			input,
			{ own: keptState(existing), pair: pair ? keptState(pair) : null },
			existing.isOpening === 1
		);
	});
}

export function deleteTransaction(db: Db, id: string): void {
	tx(db, () => {
		const { existing } = getEditable(db, id);
		run(db, 'DELETE FROM transactions WHERE id IN (?, ?)', [id, existing.transferId]);
	});
}

/** Marks a transaction cleared or not. A reconciled one stays cleared. */
export function setCleared(db: Db, id: string, cleared: boolean): void {
	const { existing } = getEditable(db, id);
	if (!cleared && existing.reconciled === 1) throw new DomainError('TRANSACTION_RECONCILED');
	run(db, 'UPDATE transactions SET cleared = ? WHERE id = ?', [cleared ? 1 : 0, id]);
}

/** Flags a transaction, or takes its flag off (`flag` left out). The other side of a transfer keeps its own. */
export function setFlag(db: Db, id: string, flag?: FlagColor): void {
	const value = validateFlag(flag);
	getEditable(db, id);
	run(db, 'UPDATE transactions SET flag = ? WHERE id = ?', [value, id]);
}

/** A change to apply to several transactions at once. Each field left out stays as it is. */
export interface BulkChange {
	categoryId?: string;
	date?: string;
	cleared?: boolean;
	/** null takes the flag off. */
	flag?: FlagColor | null;
}

/** How many transactions a bulk change touched, and how many it left because it didn't apply. */
export interface BulkResult {
	changed: number;
	skipped: number;
}

/** A row and its transfer pair, or null when it is gone or sits in a closed account. */
function bulkEditable(db: Db, id: string): { existing: RawRow; pair: RawRow | null } | null {
	const existing = one<{ id: string }>(db, 'SELECT id FROM transactions WHERE id = ?', [id]);
	if (!existing) return null;
	try {
		return getEditable(db, id);
	} catch (err) {
		if (err instanceof DomainError && err.code === 'ACCOUNT_CLOSED') return null;
		throw err;
	}
}

/**
 * The row whose category a bulk change sets: the row itself, or for a transfer between the budget
 * and a tracking account, its budget side. Null for rows with no category: splits, off-budget
 * rows, and transfers that stay on one side.
 */
function categoryRow(db: Db, existing: RawRow, pair: RawRow | null): string | null {
	const onBudget = (row: RawRow) => getAccountInfo(db, row.accountId).onBudget === 1;
	if (pair) {
		if (onBudget(existing) === onBudget(pair)) return null;
		return onBudget(existing) ? existing.id : pair.id;
	}
	const split = one<{ s: number }>(db, 'SELECT is_split AS s FROM transactions WHERE id = ?', [
		existing.id
	]);
	return onBudget(existing) && split?.s === 0 ? existing.id : null;
}

/**
 * Applies one change to several transactions. A row the change doesn't fit is skipped, not
 * refused: one in a closed account, a split or tracking row for a category, a reconciled row for
 * uncleared. Transfers move both sides to a new date.
 */
export function updateTransactions(db: Db, ids: string[], change: BulkChange): BulkResult {
	if (change.date !== undefined && !isDate(change.date))
		throw new DomainError('INVALID_INPUT', `Invalid date ${change.date}`);
	if (change.flag !== undefined) validateFlag(change.flag);
	return tx(db, () => {
		if (change.categoryId !== undefined) checkUsableCategory(db, change.categoryId);
		const result = { changed: 0, skipped: 0 };
		for (const id of new Set(ids)) {
			const row = bulkEditable(db, id);
			const target =
				row && change.categoryId !== undefined ? categoryRow(db, row.existing, row.pair) : null;
			const fits =
				row !== null &&
				(change.categoryId === undefined || target !== null) &&
				(change.cleared !== false || row.existing.reconciled === 0);
			if (!fits) {
				result.skipped++;
				continue;
			}
			if (target !== null)
				run(db, 'UPDATE transactions SET category_id = ? WHERE id = ?', [
					change.categoryId!,
					target
				]);
			if (change.date !== undefined)
				run(db, 'UPDATE transactions SET date = ? WHERE id IN (?, ?)', [
					change.date,
					id,
					row.existing.transferId
				]);
			if (change.cleared !== undefined)
				run(db, 'UPDATE transactions SET cleared = ? WHERE id = ?', [change.cleared ? 1 : 0, id]);
			if (change.flag !== undefined)
				run(db, 'UPDATE transactions SET flag = ? WHERE id = ?', [change.flag, id]);
			result.changed++;
		}
		return result;
	});
}

/** Deletes several transactions (a transfer once, whichever sides are chosen), skipping any in a closed account. */
export function deleteTransactions(db: Db, ids: string[]): BulkResult {
	return tx(db, () => {
		const result = { changed: 0, skipped: 0 };
		const gone = new Set<string>();
		for (const id of new Set(ids)) {
			if (gone.has(id)) continue;
			const row = bulkEditable(db, id);
			if (!row) {
				result.skipped++;
				continue;
			}
			run(db, 'DELETE FROM transactions WHERE id IN (?, ?)', [id, row.existing.transferId]);
			if (row.existing.transferId) gone.add(row.existing.transferId);
			result.changed++;
		}
		return result;
	});
}

type Row = Omit<TransactionRow, 'cleared' | 'isSplit' | 'isOpening' | 'reconciled' | 'splits'> & {
	cleared: number;
	isSplit: number;
	isOpening: number;
	reconciled: number;
};

const SELECT_SQL = `SELECT t.id, t.account_id AS accountId, a.name AS accountName, t.date, t.amount,
	t.payee_id AS payeeId, p.name AS payeeName, t.category_id AS categoryId, c.name AS categoryName,
	t.memo, t.cleared, t.transfer_id AS transferId, pt.account_id AS transferAccountId,
	pa.name AS transferAccountName, t.is_split AS isSplit, t.is_opening AS isOpening,
	t.reconciled, t.flag
	FROM transactions t
	JOIN accounts a ON a.id = t.account_id
	LEFT JOIN payees p ON p.id = t.payee_id
	LEFT JOIN categories c ON c.id = t.category_id
	LEFT JOIN transactions pt ON pt.id = t.transfer_id
	LEFT JOIN accounts pa ON pa.id = pt.account_id`;

function attachSplits(db: Db, rows: Row[]): TransactionRow[] {
	const splitIds = rows.filter((r) => r.isSplit === 1).map((r) => r.id);
	const splits =
		splitIds.length === 0
			? []
			: all<SplitRow & { transactionId: string }>(
					db,
					`SELECT s.id, s.transaction_id AS transactionId, s.category_id AS categoryId,
						c.name AS categoryName, s.amount, s.memo
					 FROM transaction_splits s JOIN categories c ON c.id = s.category_id
					 WHERE s.transaction_id IN (SELECT value FROM json_each(?))
					 ORDER BY s.rowid`,
					[JSON.stringify(splitIds)]
				);
	const byTransaction = groupBy(splits, (s) => s.transactionId);
	return rows.map((r) => ({
		...r,
		cleared: r.cleared === 1,
		isSplit: r.isSplit === 1,
		isOpening: r.isOpening === 1,
		reconciled: r.reconciled === 1,
		splits: (byTransaction.get(r.id) ?? []).map((s) => ({
			id: s.id,
			categoryId: s.categoryId,
			categoryName: s.categoryName,
			amount: s.amount,
			memo: s.memo
		}))
	}));
}

export function getTransaction(db: Db, id: string): TransactionRow {
	const row = one<Row>(db, `${SELECT_SQL} WHERE t.id = ?`, [id]);
	if (!row) throw new DomainError('NOT_FOUND', `Transaction ${id} not found`);
	return attachSplits(db, [row])[0];
}

const MATCH_SETS = ['accounts', 'payees', 'categories', 'memos'] as const;

/** The ids and memos that contain a search term, found once per query, before the scan. */
type TermMatches = { amount: number | null } & Record<(typeof MATCH_SETS)[number], string[]>;

/** Runs a query that returns one JSON array, in one step: much faster than reading many rows. */
function jsonValue<T>(db: Db, sql: string): T {
	return JSON.parse(db.selectValue(sql) as string) as T;
}

/**
 * Finds, for each term, the names and memos that contain it, ignoring case and accents. Folding
 * happens here, in JS, over distinct values: calling a JS function from SQL costs more per row
 * than folding a whole budget's names and memos at once.
 */
function matchTerms(db: Db, terms: SearchTerm[]): TermMatches[] {
	if (terms.length === 0) return [];
	const { accounts, payees, categories, memos } = perVersion(db, 'search-texts', () =>
		searchTexts(db)
	);
	return terms.map(({ text, amount }) => {
		const ids = (rows: { id: string; text: string }[]) =>
			rows.filter((r) => r.text.includes(text)).map((r) => r.id);
		return {
			amount,
			accounts: ids(accounts),
			payees: ids(payees),
			categories: ids(categories),
			memos: memos.filter((r) => r.text.includes(text)).map((r) => r.memo)
		};
	});
}

/** Every name and memo a search looks in, folded: read once between writes. */
function searchTexts(db: Db) {
	const names = (table: string) =>
		jsonValue<[string, string][]>(
			db,
			`SELECT json_group_array(json_array(id, name)) FROM ${table}`
		).map(([id, name]) => ({ id, text: foldText(name) }));
	return {
		accounts: names('accounts'),
		payees: names('payees'),
		categories: names('categories'),
		memos: jsonValue<string[]>(
			db,
			`SELECT json_group_array(memo) FROM (SELECT memo FROM transactions WHERE memo <> ''
			 UNION SELECT memo FROM transaction_splits WHERE memo <> '')`
		).map((memo) => ({ memo, text: foldText(memo) }))
	};
}

/**
 * The WHERE clause for search term `i`: the account, transfer account, payee or category, the
 * memo, a split line's category or memo, or the amount of the transaction or a split line (either
 * sign). It reads only `t`, so rows that fail it are dropped before the joins, and it leaves out
 * the sets that are empty. Null when the term can match nothing.
 */
function termCondition(match: TermMatches, i: number): string | null {
	const set = (key: (typeof MATCH_SETS)[number]) => `(SELECT value FROM json_each(:${key}${i}))`;
	const has = (key: (typeof MATCH_SETS)[number]) => match[key].length > 0;
	const own: string[] = [];
	const split: string[] = [];
	if (match.amount !== null) {
		own.push(`abs(t.amount) = :amount${i}`);
		split.push(`abs(s.amount) = :amount${i}`);
	}
	if (has('accounts'))
		own.push(
			`t.account_id IN ${set('accounts')}`,
			`(t.transfer_id IS NOT NULL
			  AND (SELECT account_id FROM transactions WHERE id = t.transfer_id) IN ${set('accounts')})`
		);
	if (has('payees')) own.push(`t.payee_id IN ${set('payees')}`);
	if (has('categories')) {
		own.push(`t.category_id IN ${set('categories')}`);
		split.push(`s.category_id IN ${set('categories')}`);
	}
	if (has('memos')) {
		own.push(`t.memo IN ${set('memos')}`);
		split.push(`s.memo IN ${set('memos')}`);
	}
	if (split.length > 0)
		own.push(`(t.is_split = 1 AND EXISTS (SELECT 1 FROM transaction_splits s
			WHERE s.transaction_id = t.id AND (${split.join(' OR ')})))`);
	return own.length > 0 ? `(${own.join('\n\t\tOR ')})` : null;
}

/**
 * Transactions newest first. `search` splits into words that must all match, each in any field
 * (see `termCondition`), ignoring case and accents; a word that reads as an amount in the budget's
 * format also matches that amount.
 */
export function listTransactions(db: Db, query: TransactionQuery = {}): TransactionRow[] {
	const terms = query.search ? searchTerms(query.search, getMeta(db)) : [];
	const bind: Record<string, string | number | null> = {
		':limit': query.limit ?? -1,
		':offset': query.offset ?? 0
	};
	// Only the filters given, so SQLite can use the index of the one that narrows the rows (an
	// account's or a payee's): `(:x IS NULL OR …)` keeps it from using any.
	const conditions: string[] = [];
	const filter = (condition: string, name: string, value: string | number | undefined) => {
		if (value === undefined || value === null) return;
		conditions.push(`AND ${condition}`);
		bind[name] = value;
	};
	filter('t.account_id = :accountId', ':accountId', query.accountId);
	filter(
		`(t.category_id = :categoryId OR EXISTS (SELECT 1 FROM transaction_splits s
			WHERE s.transaction_id = t.id AND s.category_id = :categoryId))`,
		':categoryId',
		query.categoryId
	);
	filter('t.payee_id = :payeeId', ':payeeId', query.payeeId);
	filter('t.date >= :from', ':from', query.from);
	filter('t.date <= :to', ':to', query.to);
	filter('ABS(t.amount) >= :amountMin', ':amountMin', query.amountMin);
	filter('ABS(t.amount) <= :amountMax', ':amountMax', query.amountMax);
	filter(
		't.cleared = :cleared',
		':cleared',
		query.cleared === undefined ? undefined : +query.cleared
	);
	if (query.flags !== undefined) {
		const flags = validateFlagFilter(query.flags);
		if (flags.length === 0) return [];
		filter(
			`COALESCE(t.flag, 'none') IN (SELECT value FROM json_each(:flags))`,
			':flags',
			JSON.stringify(flags)
		);
	}
	for (const [i, match] of matchTerms(db, terms).entries()) {
		const condition = termCondition(match, i);
		if (condition === null) return [];
		conditions.push(`AND ${condition}`);
		if (match.amount !== null) bind[`:amount${i}`] = match.amount;
		for (const key of MATCH_SETS)
			if (match[key].length > 0) bind[`:${key}${i}`] = JSON.stringify(match[key]);
	}
	const rows = all<Row>(
		db,
		`${SELECT_SQL}
		 WHERE 1
		   ${conditions.join('\n')}
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT :limit OFFSET :offset`,
		bind
	);
	return attachSplits(db, rows);
}
