import { uuidv7 } from 'uuidv7';
import { DomainError } from '$domain/errors';
import { isDate } from '$domain/month';
import { foldText, searchTerms, type SearchTerm } from '$domain/search';
import { all, one, run, tx, type Db } from '../connection';
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
	splits: SplitRow[];
}

export interface TransactionQuery {
	accountId?: string;
	categoryId?: string; // the transaction's category or one of its split lines'
	payeeId?: string;
	search?: string;
	from?: string;
	to?: string;
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
	 is_opening)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function write(
	db: Db,
	id: string,
	input: TransactionInput,
	pairState?: { id: string; cleared: boolean; accountId: string },
	opening = false
): void {
	const plan = validate(db, input);
	const memo = input.memo ?? '';
	const payeeId = plan.pair ? null : getOrCreatePayee(db, input.payeeName);
	const reusePair = pairState && plan.pair && pairState.accountId === plan.pair.accountId;
	const pairId = plan.pair ? (reusePair ? pairState.id : uuidv7()) : null;

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
		opening ? 1 : 0
	]);
	if (plan.pair && pairId) {
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
			0
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
}

function getRaw(db: Db, id: string): RawRow {
	const row = one<RawRow>(
		db,
		`SELECT id, account_id AS accountId, transfer_id AS transferId, cleared, is_opening AS isOpening
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

/** Replaces a transaction (and its transfer pair / splits) while keeping its id. */
export function updateTransaction(db: Db, id: string, input: TransactionInput): void {
	tx(db, () => {
		const { existing, pair } = getEditable(db, id);
		run(db, 'DELETE FROM transactions WHERE id IN (?, ?)', [id, existing.transferId]);
		write(
			db,
			id,
			input,
			pair ? { id: pair.id, cleared: pair.cleared === 1, accountId: pair.accountId } : undefined,
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

export function setCleared(db: Db, id: string, cleared: boolean): void {
	getEditable(db, id);
	run(db, 'UPDATE transactions SET cleared = ? WHERE id = ?', [cleared ? 1 : 0, id]);
}

type Row = Omit<TransactionRow, 'cleared' | 'isSplit' | 'splits'> & {
	cleared: number;
	isSplit: number;
};

const SELECT_SQL = `SELECT t.id, t.account_id AS accountId, a.name AS accountName, t.date, t.amount,
	t.payee_id AS payeeId, p.name AS payeeName, t.category_id AS categoryId, c.name AS categoryName,
	t.memo, t.cleared, t.transfer_id AS transferId, pt.account_id AS transferAccountId,
	pa.name AS transferAccountName, t.is_split AS isSplit
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
	return rows.map((r) => ({
		...r,
		cleared: r.cleared === 1,
		isSplit: r.isSplit === 1,
		splits: splits
			.filter((s) => s.transactionId === r.id)
			.map((s) => ({
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
	const names = (table: string) =>
		jsonValue<[string, string][]>(
			db,
			`SELECT json_group_array(json_array(id, name)) FROM ${table}`
		).map(([id, name]) => ({ id, text: foldText(name) }));
	const accounts = names('accounts');
	const payees = names('payees');
	const categories = names('categories');
	const memos = jsonValue<string[]>(
		db,
		`SELECT json_group_array(memo) FROM (SELECT memo FROM transactions WHERE memo <> ''
		 UNION SELECT memo FROM transaction_splits WHERE memo <> '')`
	).map((memo) => ({ memo, text: foldText(memo) }));
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
		':accountId': query.accountId ?? null,
		':categoryId': query.categoryId ?? null,
		':payeeId': query.payeeId ?? null,
		':from': query.from ?? null,
		':to': query.to ?? null,
		':limit': query.limit ?? -1,
		':offset': query.offset ?? 0
	};
	const conditions: string[] = [];
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
		 WHERE (:accountId IS NULL OR t.account_id = :accountId)
		   AND (:categoryId IS NULL OR t.category_id = :categoryId
		     OR EXISTS (SELECT 1 FROM transaction_splits s
		                WHERE s.transaction_id = t.id AND s.category_id = :categoryId))
		   AND (:payeeId IS NULL OR t.payee_id = :payeeId)
		   AND (:from IS NULL OR t.date >= :from)
		   AND (:to IS NULL OR t.date <= :to)
		   ${conditions.join('\n')}
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT :limit OFFSET :offset`,
		bind
	);
	return attachSplits(db, rows);
}
