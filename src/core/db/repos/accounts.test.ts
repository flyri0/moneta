import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all } from '../connection';
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
import { defaultIncomeCategoryId } from './meta';

const code = (c: string) => expect.objectContaining({ code: c });
const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' } as const;
const acct = (p: Partial<CreateAccountInput> & Pick<CreateAccountInput, 'name' | 'type'>) => ({
	...base,
	...p
});

describe('createAccount', () => {
	it('records an on-budget starting balance as default income category', async () => {
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
			categoryId: defaultIncomeCategoryId(db),
			cleared: true,
			date: '2026-01-01'
		});
	});

	// Review Focus Pin #1: Negative starting balance on credit card
	it('creates credit card without payment category and assigns starting debt to default income category', async () => {
		const db = await createBudgetDb();
		const cardId = createAccount(db, {
			name: 'Nubank',
			type: 'credit_card',
			onBudget: true,
			startingBalance: -150000,
			startingDate: '2026-01-01'
		});

		const card = getAccount(db, cardId);
		expect(card.balance).toBe(-150000);

		// No payment category created
		const cats = all<{ name: string }>(db, "SELECT name FROM categories WHERE name = 'Nubank'");
		expect(cats).toEqual([]);

		// Starting balance transaction categorized to income
		const txns = listTransactions(db, { accountId: cardId });
		expect(txns.length).toBe(1);
		expect(txns[0].amount).toBe(-150000);
		expect(txns[0].categoryId).toBe(defaultIncomeCategoryId(db));
	});

	it('coerces credit cards with onBudget: false to onBudget: true', async () => {
		const db = await createBudgetDb();
		const id = createAccount(
			db,
			acct({ name: 'Nubank', type: 'credit_card', onBudget: false, startingBalance: 0 })
		);
		expect(getAccount(db, id).onBudget).toBe(true);
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

	it('renames an account', async () => {
		const db = await createBudgetDb();
		const id = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		renameAccount(db, id, 'Visa Gold');
		expect(getAccount(db, id).name).toBe('Visa Gold');
	});

	it('closes and reopens only zero-balance accounts', async () => {
		const db = await createBudgetDb();
		const bank = createAccount(db, acct({ name: 'Bank', type: 'checking', startingBalance: 100 }));
		expect(() => closeAccount(db, bank)).toThrow(code('ACCOUNT_BALANCE_NOT_ZERO'));
		const card = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		closeAccount(db, card);
		expect(getAccount(db, card).closed).toBe(true);
		reopenAccount(db, card);
		expect(getAccount(db, card).closed).toBe(false);
	});

	it('closes credit card when balance is zero without payment category check', async () => {
		const db = await createBudgetDb();
		const cardId = createAccount(db, {
			name: 'Nubank',
			type: 'credit_card',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		closeAccount(db, cardId);
		expect(getAccount(db, cardId).closed).toBe(true);
	});

	it('deletes only accounts without transactions', async () => {
		const db = await createBudgetDb();
		const bank = createAccount(db, acct({ name: 'Bank', type: 'checking', startingBalance: 100 }));
		expect(() => deleteAccount(db, bank)).toThrow(code('ACCOUNT_HAS_TRANSACTIONS'));
		const card = createAccount(db, acct({ name: 'Visa', type: 'credit_card' }));
		deleteAccount(db, card);
		expect(() => getAccount(db, card)).toThrow(code('NOT_FOUND'));
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
