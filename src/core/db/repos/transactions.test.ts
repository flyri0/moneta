import { describe, it, expect, beforeEach } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, type Db } from '../connection';
import { closeAccount, createAccount, getAccount } from './accounts';
import {
	createTransaction,
	deleteTransaction,
	getTransaction,
	listTransactions,
	setCleared,
	updateTransaction
} from './transactions';
import { listPayees } from './payees';
import { defaultIncomeCategoryId } from './meta';

const code = (c: string) => expect.objectContaining({ code: c });

let db: Db;
let bank: string;
let savings: string;
let visa: string;
let broker: string;
let food: string;
let fun: string;

beforeEach(async () => {
	db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	savings = createAccount(db, { ...base, name: 'Savings', type: 'savings' });
	visa = createAccount(db, { ...base, name: 'Visa', type: 'credit_card' });
	broker = createAccount(db, { ...base, name: 'Broker', type: 'investment', onBudget: false });
	food = categoryId(db, 'Food');
	fun = categoryId(db, 'Fun');
});

describe('simple transactions', () => {
	it('creates a categorized transaction and its payee', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -4500,
			payeeName: 'Mercado',
			categoryId: food,
			memo: 'weekly',
			cleared: true
		});
		expect(getTransaction(db, id)).toMatchObject({
			accountName: 'Bank',
			amount: -4500,
			payeeName: 'Mercado',
			categoryName: 'Food',
			memo: 'weekly',
			cleared: true,
			isSplit: false,
			splits: [],
			transferId: null
		});
	});

	it('reuses payees case-insensitively and remembers their last category', () => {
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -1,
			payeeName: 'Mercado',
			categoryId: fun
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-06',
			amount: -1,
			payeeName: 'mercado',
			categoryId: food
		});
		expect(listPayees(db)).toEqual([
			expect.objectContaining({ name: 'Mercado', lastCategoryId: food })
		]);
	});

	it('requires a category on on-budget accounts including credit cards', () => {
		expect(() =>
			createTransaction(db, { accountId: bank, date: '2026-01-05', amount: -1 })
		).toThrow(code('CATEGORY_REQUIRED'));
		expect(() =>
			createTransaction(db, { accountId: visa, date: '2026-01-05', amount: -1 })
		).toThrow(code('CATEGORY_REQUIRED'));
	});

	it('forbids categories on off-budget accounts', () => {
		expect(() =>
			createTransaction(db, {
				accountId: broker,
				date: '2026-01-05',
				amount: 100,
				categoryId: food
			})
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
		expect(() =>
			createTransaction(db, { accountId: broker, date: '2026-01-05', amount: 100 })
		).not.toThrow();
	});

	// Review Focus Pin #5: Inflow / cashback on credit card
	it('allows inflow to income category on a credit card', () => {
		const card = createAccount(db, {
			name: 'Nubank',
			type: 'credit_card',
			onBudget: true,
			startingBalance: -50000,
			startingDate: '2026-01-01'
		});
		const incomeId = defaultIncomeCategoryId(db);

		const id = createTransaction(db, {
			accountId: card,
			date: '2026-01-10',
			amount: 2000, // cashback
			categoryId: incomeId
		});

		expect(getTransaction(db, id).categoryId).toBe(incomeId);
		expect(getAccount(db, card).balance).toBe(-48000);
	});

	it('validates amount and date', () => {
		expect(() =>
			createTransaction(db, { accountId: bank, date: '2026-02-30', amount: -1, categoryId: food })
		).toThrow(code('INVALID_INPUT'));
		expect(() =>
			createTransaction(db, { accountId: bank, date: '2026-01-05', amount: -1.5, categoryId: food })
		).toThrow(code('INVALID_INPUT'));
	});

	it('toggles cleared and deletes', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -1,
			categoryId: food
		});
		setCleared(db, id, true);
		expect(getTransaction(db, id).cleared).toBe(true);
		deleteTransaction(db, id);
		expect(() => getTransaction(db, id)).toThrow(code('NOT_FOUND'));
	});
});

describe('splits', () => {
	it('stores split lines that sum to the amount', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -10000,
			payeeName: 'Loja',
			splits: [
				{ categoryId: food, amount: -7000, memo: 'groceries' },
				{ categoryId: fun, amount: -3000 }
			]
		});
		const t = getTransaction(db, id);
		expect(t).toMatchObject({ isSplit: true, categoryId: null });
		expect(t.splits.map((s) => [s.categoryName, s.amount, s.memo])).toEqual([
			['Food', -7000, 'groceries'],
			['Fun', -3000, '']
		]);
	});

	it('rejects mismatched sums, single lines, and a category alongside splits', () => {
		const input = { accountId: bank, date: '2026-01-05', amount: -10000 };
		expect(() =>
			createTransaction(db, {
				...input,
				splits: [
					{ categoryId: food, amount: -7000 },
					{ categoryId: fun, amount: -2000 }
				]
			})
		).toThrow(code('SPLIT_SUM_MISMATCH'));
		expect(() =>
			createTransaction(db, { ...input, splits: [{ categoryId: food, amount: -10000 }] })
		).toThrow(code('SPLIT_TOO_FEW_LINES'));
		expect(() =>
			createTransaction(db, {
				...input,
				categoryId: food,
				splits: [
					{ categoryId: food, amount: -5000 },
					{ categoryId: fun, amount: -5000 }
				]
			})
		).toThrow(code('INVALID_INPUT'));
	});

	it('removes old split lines on update and on delete', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -100,
			splits: [
				{ categoryId: food, amount: -60 },
				{ categoryId: fun, amount: -40 }
			]
		});
		updateTransaction(db, id, {
			accountId: bank,
			date: '2026-01-05',
			amount: -100,
			categoryId: food
		});
		expect(getTransaction(db, id)).toMatchObject({ isSplit: false, categoryId: food, splits: [] });
		expect(all(db, 'SELECT * FROM transaction_splits')).toEqual([]);
	});
});

describe('transfers', () => {
	// Review Focus Pin #4: Budget-neutral transfer between checking and credit card
	it('creates budget-neutral transfer between checking and credit card with no category', () => {
		const checking = createAccount(db, {
			name: 'Checking',
			type: 'checking',
			onBudget: true,
			startingBalance: 100000,
			startingDate: '2026-01-01'
		});
		const card = createAccount(db, {
			name: 'Nubank',
			type: 'credit_card',
			onBudget: true,
			startingBalance: -50000,
			startingDate: '2026-01-01'
		});

		// Paying the card
		const id = createTransaction(db, {
			accountId: checking,
			date: '2026-01-05',
			amount: -50000,
			transferAccountId: card
		});

		const t = getTransaction(db, id);
		expect(t.categoryId).toBeNull();
		expect(getAccount(db, checking).balance).toBe(50000);
		expect(getAccount(db, card).balance).toBe(0);
	});

	it('creates a budget-neutral pair between on-budget accounts', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			transferAccountId: savings
		});
		const t = getTransaction(db, id);
		expect(t).toMatchObject({
			categoryId: null,
			payeeId: null,
			transferAccountId: savings,
			transferAccountName: 'Savings'
		});
		const pair = getTransaction(db, t.transferId!);
		expect(pair).toMatchObject({
			accountId: savings,
			amount: 5000,
			transferId: id,
			transferAccountId: bank,
			cleared: false
		});
	});

	it('rejects a category on budget-neutral transfers', () => {
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-10',
				amount: -1,
				transferAccountId: savings,
				categoryId: food
			})
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});

	it('requires a category for the on-budget leg of an on/off-budget transfer', () => {
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-10',
				amount: -1,
				transferAccountId: broker
			})
		).toThrow(code('CATEGORY_REQUIRED'));
		// entered from the off-budget side: category lands on the on-budget leg
		const id = createTransaction(db, {
			accountId: broker,
			date: '2026-01-10',
			amount: -20000,
			transferAccountId: bank,
			categoryId: food
		});
		const t = getTransaction(db, id);
		expect(t.categoryId).toBeNull();
		expect(getTransaction(db, t.transferId!)).toMatchObject({
			accountId: bank,
			amount: 20000,
			categoryName: 'Food'
		});
	});

	it('rejects invalid transfers', () => {
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-10',
				amount: -1,
				transferAccountId: bank
			})
		).toThrow(code('TRANSFER_INVALID'));
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-10',
				amount: -2,
				transferAccountId: savings,
				splits: [
					{ categoryId: food, amount: -1 },
					{ categoryId: fun, amount: -1 }
				]
			})
		).toThrow(code('TRANSFER_INVALID'));
	});

	it('updates both legs, keeping ids and the pair’s cleared flag', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			transferAccountId: savings
		});
		const pairId = getTransaction(db, id).transferId!;
		setCleared(db, pairId, true);
		updateTransaction(db, id, {
			accountId: bank,
			date: '2026-01-11',
			amount: -6000,
			transferAccountId: savings
		});
		expect(getTransaction(db, id)).toMatchObject({
			date: '2026-01-11',
			amount: -6000,
			transferId: pairId
		});
		expect(getTransaction(db, pairId)).toMatchObject({
			date: '2026-01-11',
			amount: 6000,
			cleared: true
		});
	});

	it('turns a transfer into a regular transaction and back', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			transferAccountId: savings
		});
		updateTransaction(db, id, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			categoryId: food,
			payeeName: 'X'
		});
		expect(getTransaction(db, id)).toMatchObject({
			transferId: null,
			categoryId: food,
			payeeName: 'X'
		});
		expect(all(db, 'SELECT id FROM transactions')).toEqual([{ id }]);
		updateTransaction(db, id, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			transferAccountId: visa
		});
		expect(getTransaction(db, id).transferAccountId).toBe(visa);
	});

	it('deletes both legs', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			transferAccountId: savings
		});
		deleteTransaction(db, id);
		expect(all(db, 'SELECT id FROM transactions')).toEqual([]);
	});
});

describe('listTransactions', () => {
	beforeEach(() => {
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -100,
			payeeName: 'Padaria',
			categoryId: food
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-02-05',
			amount: -200,
			payeeName: 'Cinema',
			categoryId: fun,
			memo: '50% off'
		});
		createTransaction(db, {
			accountId: visa,
			date: '2026-03-05',
			amount: -300,
			payeeName: 'Loja',
			splits: [
				{ categoryId: food, amount: -150 },
				{ categoryId: fun, amount: -150, memo: 'toys' }
			]
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-03-06',
			amount: -400,
			transferAccountId: savings
		});
	});

	it('orders newest first and filters by account and date range', () => {
		// same date: the transfer pair leg was created last, so its (time-ordered) id sorts first
		expect(listTransactions(db).map((t) => t.amount)).toEqual([400, -400, -300, -200, -100]);
		expect(listTransactions(db, { accountId: bank }).map((t) => t.amount)).toEqual([
			-400, -200, -100
		]);
		expect(
			listTransactions(db, { from: '2026-02-01', to: '2026-03-05' }).map((t) => t.amount)
		).toEqual([-300, -200]);
	});

	it('searches payee, memo, category, account, transfer account and split lines', () => {
		expect(listTransactions(db, { search: 'padaria' }).map((t) => t.amount)).toEqual([-100]);
		expect(listTransactions(db, { search: '50%' }).map((t) => t.amount)).toEqual([-200]);
		expect(listTransactions(db, { search: 'toys' }).map((t) => t.amount)).toEqual([-300]);
		expect(listTransactions(db, { search: 'Fun' }).map((t) => t.amount)).toEqual([-300, -200]);
		expect(listTransactions(db, { search: 'visa' }).map((t) => t.amount)).toEqual([-300]);
		// both legs: one is in Savings, the other transfers to it
		expect(listTransactions(db, { search: 'savings' }).map((t) => t.amount)).toEqual([400, -400]);
	});

	it('needs every word of the search to match, each in any field', () => {
		expect(listTransactions(db, { search: 'bank fun' }).map((t) => t.amount)).toEqual([-200]);
		expect(listTransactions(db, { search: 'loja  toys' }).map((t) => t.amount)).toEqual([-300]);
		expect(listTransactions(db, { search: 'visa padaria' })).toEqual([]);
	});

	it('ignores case and accents on both sides', () => {
		const poupanca = createAccount(db, {
			name: 'Poupança',
			type: 'savings',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		createTransaction(db, {
			accountId: poupanca,
			date: '2026-04-01',
			amount: -500,
			payeeName: 'Açougue',
			memo: 'PÃO de queijo',
			categoryId: food
		});
		for (const search of ['acougue', 'ACOUGUE', 'Açougue', 'pao', 'poupanca', 'POUPANÇA'])
			expect(listTransactions(db, { search }).map((t) => t.amount)).toEqual([-500]);
		expect(listTransactions(db, { search: 'OFF' }).map((t) => t.amount)).toEqual([-200]);
		expect(listTransactions(db, { search: 'Toys' }).map((t) => t.amount)).toEqual([-300]);
	});

	it('matches an amount, either sign, on the transaction or a split line', () => {
		expect(listTransactions(db, { search: '4,00' }).map((t) => t.amount)).toEqual([400, -400]);
		expect(listTransactions(db, { search: '-2' }).map((t) => t.amount)).toEqual([-200]);
		expect(listTransactions(db, { search: '1.50' }).map((t) => t.amount)).toEqual([-300]);
		expect(listTransactions(db, { search: 'visa 1,50' }).map((t) => t.amount)).toEqual([-300]);
		expect(listTransactions(db, { search: 'cinema 1' })).toEqual([]);
	});

	it('combines the search with the other filters', () => {
		expect(listTransactions(db, { search: 'fun', accountId: bank }).map((t) => t.amount)).toEqual([
			-200
		]);
		expect(
			listTransactions(db, { search: 'food', from: '2026-02-01' }).map((t) => t.amount)
		).toEqual([-300]);
	});

	it('filters by category, including split lines', () => {
		expect(listTransactions(db, { categoryId: food }).map((t) => t.amount)).toEqual([-300, -100]);
		expect(
			listTransactions(db, { categoryId: fun, from: '2026-03-01' }).map((t) => t.amount)
		).toEqual([-300]);
	});

	it('pages with limit and offset', () => {
		expect(listTransactions(db, { limit: 2, offset: 1 }).map((t) => t.amount)).toEqual([
			-400, -300
		]);
	});
});

describe('closed accounts stay frozen', () => {
	// Two offsetting lines leave Bank at 0 so it can be closed.
	function closeBankWithHistory(): string {
		createTransaction(db, { accountId: bank, date: '2026-01-05', amount: 10000, categoryId: food });
		const outflow = createTransaction(db, {
			accountId: bank,
			date: '2026-01-06',
			amount: -10000,
			categoryId: food
		});
		closeAccount(db, bank);
		return outflow;
	}

	it('refuses to delete a transaction in a closed account', () => {
		const outflow = closeBankWithHistory();
		expect(() => deleteTransaction(db, outflow)).toThrow(code('ACCOUNT_CLOSED'));
		expect(getAccount(db, bank).balance).toBe(0);
	});

	it('refuses to delete a transfer whose other leg is in a closed account', () => {
		// Bank -> Savings 50.00, then Savings -> Bank 50.00: Savings nets to 0 and is closed.
		const there = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -5000,
			transferAccountId: savings
		});
		createTransaction(db, {
			accountId: savings,
			date: '2026-01-06',
			amount: -5000,
			transferAccountId: bank
		});
		closeAccount(db, savings);
		expect(() => deleteTransaction(db, there)).toThrow(code('ACCOUNT_CLOSED'));
		expect(getAccount(db, savings).balance).toBe(0);
		expect(getAccount(db, bank).balance).toBe(0);
	});

	it('refuses to move a transaction out of a closed account', () => {
		const outflow = closeBankWithHistory();
		expect(() =>
			updateTransaction(db, outflow, {
				accountId: savings,
				date: '2026-01-06',
				amount: -10000,
				categoryId: food
			})
		).toThrow(code('ACCOUNT_CLOSED'));
		expect(getAccount(db, bank).balance).toBe(0);
		expect(getAccount(db, savings).balance).toBe(0);
	});

	it('refuses to toggle cleared in a closed account', () => {
		const outflow = closeBankWithHistory();
		expect(() => setCleared(db, outflow, true)).toThrow(code('ACCOUNT_CLOSED'));
		expect(getAccount(db, bank)).toMatchObject({ balance: 0, clearedBalance: 0 });
		expect(getTransaction(db, outflow).cleared).toBe(false);
	});
});
