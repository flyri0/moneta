import { uuidv7 } from 'uuidv7';
import { DomainError } from '$lib/domain/errors';
import { isDate } from '$lib/domain/month';
import { all, one, run, tx, type Db } from '../connection';
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

/** Categories that transactions may use: anything except card payment categories. */
function checkUsableCategory(db: Db, id: string): void {
	const row = one<{ ccAccountId: string | null }>(
		db,
		'SELECT cc_account_id AS ccAccountId FROM categories WHERE id = ?',
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Category ${id} not found`);
	if (row.ccAccountId)
		throw new DomainError(
			'CATEGORY_NOT_ALLOWED',
			'Card payment categories are managed automatically'
		);
}

interface Plan {
	mainCategoryId: string | null;
	pair: { accountId: string; categoryId: string | null } | null;
	splits: SplitInput[];
}

function validate(db: Db, input: TransactionInput): Plan {
	const account = getAccountInfo(db, input.accountId);
	if (account.closed) throw new DomainError('ACCOUNT_CLOSED');
	if (!Number.isInteger(input.amount))
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
			if (!Number.isInteger(s.amount))
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

	if (categoryId) checkUsableCategory(db, categoryId);
	else if (account.type !== 'credit_card') throw new DomainError('CATEGORY_REQUIRED');
	return { mainCategoryId: categoryId, pair: null, splits: [] };
}

const INSERT_SQL = `INSERT INTO transactions
	(id, account_id, date, amount, payee_id, category_id, memo, cleared, transfer_id, is_split)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function write(
	db: Db,
	id: string,
	input: TransactionInput,
	pairState?: { id: string; cleared: boolean; accountId: string }
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
		plan.splits.length > 0 ? 1 : 0
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
}

function getRaw(db: Db, id: string): RawRow {
	const row = one<RawRow>(
		db,
		'SELECT id, account_id AS accountId, transfer_id AS transferId, cleared FROM transactions WHERE id = ?',
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

/** Replaces a transaction (and its transfer pair / splits) while keeping its id. */
export function updateTransaction(db: Db, id: string, input: TransactionInput): void {
	tx(db, () => {
		const { existing, pair } = getEditable(db, id);
		run(db, 'DELETE FROM transactions WHERE id IN (?, ?)', [id, existing.transferId]);
		write(
			db,
			id,
			input,
			pair ? { id: pair.id, cleared: pair.cleared === 1, accountId: pair.accountId } : undefined
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

function likePattern(search: string): string {
	return `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export function listTransactions(db: Db, query: TransactionQuery = {}): TransactionRow[] {
	const search = query.search?.trim() ? likePattern(query.search.trim()) : null;
	const rows = all<Row>(
		db,
		`${SELECT_SQL}
		 WHERE (:accountId IS NULL OR t.account_id = :accountId)
		   AND (:from IS NULL OR t.date >= :from)
		   AND (:to IS NULL OR t.date <= :to)
		   AND (:search IS NULL
		     OR p.name LIKE :search ESCAPE '\\' OR t.memo LIKE :search ESCAPE '\\'
		     OR c.name LIKE :search ESCAPE '\\' OR pa.name LIKE :search ESCAPE '\\'
		     OR EXISTS (SELECT 1 FROM transaction_splits s JOIN categories sc ON sc.id = s.category_id
		                WHERE s.transaction_id = t.id
		                  AND (sc.name LIKE :search ESCAPE '\\' OR s.memo LIKE :search ESCAPE '\\')))
		 ORDER BY t.date DESC, t.id DESC
		 LIMIT :limit OFFSET :offset`,
		{
			':accountId': query.accountId ?? null,
			':from': query.from ?? null,
			':to': query.to ?? null,
			':search': search,
			':limit': query.limit ?? -1,
			':offset': query.offset ?? 0
		}
	);
	return attachSplits(db, rows);
}
