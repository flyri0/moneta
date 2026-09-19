import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, one, type Db } from '../connection';
import {
	closeAccount,
	createAccount,
	deleteAccount,
	getAccount,
	listAccounts,
	renameAccount,
	reopenAccount,
	type CreateAccountInput
} from './accounts';
import { createTransaction, listTransactions } from './transactions';

const code = (c: string) => expect.objectContaining({ code: c });
const cardCategory = (db: Db, name: string) =>
	one<{ ccAccountId: string; hidden: number }>(
		db,
		'SELECT cc_account_id AS ccAccountId, hidden FROM categories WHERE name = ?',
		[name]
	);
const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' } as const;
const acct = (p: Partial<CreateAccountInput> & Pick<CreateAccountInput, 'name' | 'type'>) => ({
	...base,
	...p
});

describe('createAccount', () => {
	it('records an on-budget starting balance as Ready to Assign income', async () => {
		const db = await createBudgetDb();
		const id = createAccount(db, acct({ name: 'Bank', type: 'checking', startingBalance: 150000 }));
		expect(getAccount(db, id)).toMatchObject({
			name: 'Bank',
			onBudget: true,
			balance: 150000,
			clearedBalance: 150000
		});
		const [t] = listTransactions(db, { accountId: id });
		expect(t).toMatchObject({
			amount: 150000,
			payeeName: 'Starting Balance',
			categoryName: 'Ready to Assign',
			cleared: true,
			date: '2026-01-01'
		});
	});

	it('creates a card payment category and leaves starting debt uncategorized', async () => {
		const db = await createBudgetDb();
		const id = createAccount(
			db,
			acct({ name: 'Visa', type: 'credit_card', onBudget: false, startingBalance: -50000 })
		);
		expect(getAccount(db, id)).toMatchObject({ onBudget: true, balance: -50000 });
		expect(cardCategory(db, 'Visa')?.ccAccountId).toBe(id);
		expect(listTransactions(db, { accountId: id })[0].categoryId).toBeNull();
	});

	it('leaves off-budget starting balances uncategorized', async () => {
		const db = await createBudgetDb();
		const id = createAccount(
			db,
			acct({ name: 'Broker', type: 'investment', onBudget: false, startingBalance: 900000 })
		);
		expect(getAccount(db, id).onBudget).toBe(false);
		expect(listTransactions(db, { accountId: id })[0].categoryId).toBeNull();
	});

	it('skips the starting transaction when the balance is zero', async () => {
		const db = await createBudgetDb();
		const id = createAccount(db, acct({ name: 'Wallet', type: 'cash' }));
		expect(listTransactions(db, { accountId: id })).toEqual([]);
	});
});

describe('account lifecycle', () => {
	it('lists open on-budget accounts first, then off-budget, then closed', async () => {
		const db = await createBudgetDb();
		const a = createAccount(db, acct({ name: 'Broker', type: 'investment', onBudget: false }));
		createAccount(db, acct({ name: 'Bank', type: 'checking' }));
		const c = createAccount(db, acct({ name: 'Old', type: 'savings' }));
		closeAccount(db, c);
		expect(listAccounts(db).map((x) => x.name)).toEqual(['Bank', 'Broker', 'Old']);
		expect(listAccounts(db).find((x) => x.id === a)?.onBudget).toBe(false);
	});

	it('renames a card together with its payment category', async () => {
		const db = await createBudgetDb();
		const id = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		renameAccount(db, id, 'Visa Gold');
		expect(getAccount(db, id).name).toBe('Visa Gold');
		expect(cardCategory(db, 'Visa Gold')?.ccAccountId).toBe(id);
	});

	it('closes only zero-balance accounts and hides/unhides card categories', async () => {
		const db = await createBudgetDb();
		const bank = createAccount(db, acct({ name: 'Bank', type: 'checking', startingBalance: 100 }));
		expect(() => closeAccount(db, bank)).toThrow(code('ACCOUNT_BALANCE_NOT_ZERO'));
		const card = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		closeAccount(db, card);
		expect(getAccount(db, card).closed).toBe(true);
		expect(cardCategory(db, 'Visa')?.hidden).toBe(1);
		reopenAccount(db, card);
		expect(getAccount(db, card).closed).toBe(false);
		expect(cardCategory(db, 'Visa')?.hidden).toBe(0);
	});

	it('deletes only accounts without transactions, removing card categories', async () => {
		const db = await createBudgetDb();
		const bank = createAccount(db, acct({ name: 'Bank', type: 'checking', startingBalance: 100 }));
		expect(() => deleteAccount(db, bank)).toThrow(code('ACCOUNT_HAS_TRANSACTIONS'));
		const card = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		deleteAccount(db, card);
		expect(() => getAccount(db, card)).toThrow(code('NOT_FOUND'));
		expect(all(db, 'SELECT id FROM categories WHERE cc_account_id IS NOT NULL')).toEqual([]);
	});

	it('refuses new transactions in closed accounts', async () => {
		const db = await createBudgetDb();
		const bank = createAccount(db, acct({ name: 'Bank', type: 'checking' }));
		closeAccount(db, bank);
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-02',
				amount: -1,
				categoryId: categoryId(db, 'Food')
			})
		).toThrow(code('ACCOUNT_CLOSED'));
	});
});
