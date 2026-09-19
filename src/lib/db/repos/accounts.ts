import { uuidv7 } from 'uuidv7';
import { DomainError } from '$lib/domain/errors';
import { all, nowIso, one, run, tx, type Db } from '../connection';
import { readyToAssignCategoryId, systemGroupId } from './meta';
import { createTransaction } from './transactions';

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
}

export interface CreateAccountInput {
	name: string;
	type: AccountType;
	onBudget: boolean; // ignored for credit cards (always on-budget)
	startingBalance: number; // minor units; negative for debt
	startingDate: string; // YYYY-MM-DD
}

type AccountRow = Omit<Account, 'onBudget' | 'closed'> & { onBudget: number; closed: number };

const SELECT_SQL = `SELECT a.id, a.name, a.type, a.on_budget AS onBudget, a.closed, a.sort_order AS sortOrder,
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
		if (isCard) {
			const groupId = systemGroupId(db, 'credit_card_payments');
			run(
				db,
				`INSERT INTO categories (id, group_id, name, sort_order, cc_account_id)
				 VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories WHERE group_id = ?), ?)`,
				[uuidv7(), groupId, name, groupId, id]
			);
		}
		if (input.startingBalance !== 0) {
			createTransaction(db, {
				accountId: id,
				date: input.startingDate,
				amount: input.startingBalance,
				payeeName: 'Starting Balance',
				categoryId: onBudget && !isCard ? readyToAssignCategoryId(db) : null,
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
		run(db, 'UPDATE categories SET name = ? WHERE cc_account_id = ?', [trimmed, id]);
	});
}

export function closeAccount(db: Db, id: string): void {
	tx(db, () => {
		const account = getAccount(db, id);
		if (account.balance !== 0) throw new DomainError('ACCOUNT_BALANCE_NOT_ZERO');
		run(db, 'UPDATE accounts SET closed = 1 WHERE id = ?', [id]);
		run(db, 'UPDATE categories SET hidden = 1 WHERE cc_account_id = ?', [id]);
	});
}

export function reopenAccount(db: Db, id: string): void {
	tx(db, () => {
		getAccount(db, id);
		run(db, 'UPDATE accounts SET closed = 0 WHERE id = ?', [id]);
		run(db, 'UPDATE categories SET hidden = 0 WHERE cc_account_id = ?', [id]);
	});
}

export function deleteAccount(db: Db, id: string): void {
	tx(db, () => {
		getAccount(db, id);
		if (one(db, 'SELECT 1 AS x FROM transactions WHERE account_id = ?', [id]))
			throw new DomainError('ACCOUNT_HAS_TRANSACTIONS');
		run(db, 'DELETE FROM categories WHERE cc_account_id = ?', [id]);
		run(db, 'DELETE FROM accounts WHERE id = ?', [id]);
	});
}
