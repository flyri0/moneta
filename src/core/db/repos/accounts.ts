import { uuidv7 } from 'uuidv7';
import { validateBillingDays, type BillingDays } from '$domain/card-bill';
import { DomainError } from '$domain/errors';
import { isDate } from '$domain/month';
import { all, nowIso, one, run, tx, type Db } from '../connection';
import { ensureStartingBalanceCategory } from './meta';
import { createStartingBalance, createTransaction } from './transactions';

export type AccountType =
	'checking' | 'savings' | 'cash' | 'credit_card' | 'investment' | 'loan' | 'other';

export interface Account {
	id: string;
	name: string;
	type: AccountType;
	onBudget: boolean;
	closed: boolean;
	sortOrder: number;
	balance: number;
	clearedBalance: number;
	/** The date of the last reconciliation, if any. */
	reconciledOn: string | null;
	/** A credit card's billing days (both or neither), which date its installments. */
	closingDay: number | null;
	dueDay: number | null;
}

export interface CreateAccountInput {
	name: string;
	type: AccountType;
	onBudget: boolean; // ignored for credit cards (always on-budget)
	startingBalance: number; // minor units; negative for debt
	startingDate: string; // YYYY-MM-DD
	/** Where an on-budget starting balance goes; the starting balance category when left out. */
	startingBalanceCategoryId?: string | null;
	/** When a credit card's bill closes and is due. Only credit cards have them. */
	billing?: BillingDays | null;
}

type AccountRow = Omit<Account, 'onBudget' | 'closed'> & { onBudget: number; closed: number };

const SELECT_SQL = `SELECT a.id, a.name, a.type, a.on_budget AS onBudget, a.closed, a.sort_order AS sortOrder,
	a.reconciled_on AS reconciledOn, a.closing_day AS closingDay, a.due_day AS dueDay,
	COALESCE(SUM(t.amount), 0) AS balance,
	COALESCE(SUM(CASE WHEN t.cleared = 1 THEN t.amount END), 0) AS clearedBalance
	FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id`;

function toAccount(r: AccountRow): Account {
	return { ...r, onBudget: r.onBudget === 1, closed: r.closed === 1 };
}

export function listAccounts(db: Db): Account[] {
	return all<AccountRow>(
		db,
		`${SELECT_SQL} GROUP BY a.id ORDER BY a.closed, a.on_budget DESC, a.sort_order, a.name`
	).map(toAccount);
}

export function getAccount(db: Db, id: string): Account {
	const row = one<AccountRow>(db, `${SELECT_SQL} WHERE a.id = ? GROUP BY a.id`, [id]);
	if (!row) throw new DomainError('NOT_FOUND', `Account ${id} not found`);
	return toAccount(row);
}

function requireName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) throw new DomainError('INVALID_INPUT', 'Name is required');
	return trimmed;
}

export function createAccount(db: Db, input: CreateAccountInput): string {
	return tx(db, () => {
		const id = uuidv7();
		const name = requireName(input.name);
		const isCard = input.type === 'credit_card';
		const onBudget = isCard || input.onBudget;
		run(
			db,
			`INSERT INTO accounts (id, name, type, on_budget, sort_order, created_at)
			 VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM accounts), ?)`,
			[id, name, input.type, onBudget ? 1 : 0, nowIso()]
		);
		if (input.billing) writeBillingDays(db, id, input.type, input.billing);
		if (input.startingBalance !== 0) {
			createStartingBalance(db, {
				accountId: id,
				date: input.startingDate,
				amount: input.startingBalance,
				payeeName: null,
				categoryId: onBudget
					? (input.startingBalanceCategoryId ?? ensureStartingBalanceCategory(db))
					: null,
				cleared: true
			});
		}
		return id;
	});
}

export function renameAccount(db: Db, id: string, name: string): void {
	tx(db, () => {
		getAccount(db, id);
		const trimmed = requireName(name);
		run(db, 'UPDATE accounts SET name = ? WHERE id = ?', [trimmed, id]);
	});
}

function writeBillingDays(db: Db, id: string, type: AccountType, days: BillingDays | null): void {
	if (days) {
		if (type !== 'credit_card')
			throw new DomainError('INVALID_INPUT', 'Only credit cards have billing days');
		validateBillingDays(days);
	}
	run(db, 'UPDATE accounts SET closing_day = ?, due_day = ? WHERE id = ?', [
		days?.closingDay ?? null,
		days?.dueDay ?? null,
		id
	]);
}

/** Sets a credit card's closing and due days, or clears them when `days` is left out. */
export function setBillingDays(db: Db, id: string, days?: BillingDays): void {
	tx(db, () => writeBillingDays(db, id, getAccount(db, id).type, days ?? null));
}

export function closeAccount(db: Db, id: string): void {
	tx(db, () => {
		const account = getAccount(db, id);
		if (account.balance !== 0) throw new DomainError('ACCOUNT_BALANCE_NOT_ZERO');
		run(db, 'UPDATE accounts SET closed = 1 WHERE id = ?', [id]);
	});
}

export function reopenAccount(db: Db, id: string): void {
	tx(db, () => {
		getAccount(db, id);
		run(db, 'UPDATE accounts SET closed = 0 WHERE id = ?', [id]);
	});
}

export function deleteAccount(db: Db, id: string): void {
	tx(db, () => {
		getAccount(db, id);
		if (one(db, 'SELECT 1 AS x FROM transactions WHERE account_id = ?', [id]))
			throw new DomainError('ACCOUNT_HAS_TRANSACTIONS');
		run(db, 'DELETE FROM accounts WHERE id = ?', [id]);
	});
}

export interface ReconcileInput {
	/** The date of the bank's balance. */
	date: string;
	/** The balance the bank shows, which the cleared balance must match. */
	balance: number;
	/** Enters the difference as a cleared transaction (with a category on budget). */
	adjustment?: { categoryId: string | null; memo: string };
}

/**
 * Checks the cleared balance against the bank's and marks every cleared transaction reconciled.
 * A difference needs an adjustment, or it throws RECONCILE_MISMATCH with `{ difference }`.
 */
export function reconcileAccount(db: Db, id: string, input: ReconcileInput): void {
	tx(db, () => {
		const account = getAccount(db, id);
		if (account.closed) throw new DomainError('ACCOUNT_CLOSED');
		if (!isDate(input.date)) throw new DomainError('INVALID_INPUT', `Invalid date ${input.date}`);
		if (!Number.isSafeInteger(input.balance))
			throw new DomainError('INVALID_INPUT', 'Balance must be an integer');
		const difference = input.balance - account.clearedBalance;
		if (difference !== 0) {
			if (!input.adjustment) throw new DomainError('RECONCILE_MISMATCH', undefined, { difference });
			createTransaction(db, {
				accountId: id,
				date: input.date,
				amount: difference,
				categoryId: input.adjustment.categoryId,
				memo: input.adjustment.memo,
				cleared: true
			});
		}
		run(db, 'UPDATE transactions SET reconciled = 1 WHERE account_id = ? AND cleared = 1', [id]);
		run(db, 'UPDATE accounts SET reconciled_on = ? WHERE id = ?', [input.date, id]);
	});
}
