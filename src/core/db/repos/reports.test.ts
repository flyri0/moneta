import { describe, it, expect, beforeEach } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import type { Db } from '../connection';
import { createAccount } from './accounts';
import { defaultIncomeCategoryId } from './meta';
import { ageOfMoney, ageOfMoneyFlows, cashFlow, netWorth, spendingByCategory } from './reports';
import { createTransaction } from './transactions';

let db: Db;
let bank: string;
let visa: string;
let broker: string;

beforeEach(async () => {
	db = await createBudgetDb();
	const base = { onBudget: true, startingDate: '2026-08-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking', startingBalance: 200000 });
	visa = createAccount(db, { ...base, name: 'Visa', type: 'credit_card', startingBalance: -50000 });
	broker = createAccount(db, {
		...base,
		name: 'Broker',
		type: 'investment',
		onBudget: false,
		startingBalance: 100000
	});
});

describe('spendingByCategory', () => {
	beforeEach(() => {
		const food = categoryId(db, 'Food');
		const rent = categoryId(db, 'Rent');
		const fun = categoryId(db, 'Fun');
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-01',
			amount: -120000,
			categoryId: rent
		});
		createTransaction(db, { accountId: visa, date: '2026-09-05', amount: -8000, categoryId: food });
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-10',
			amount: -5000,
			splits: [
				{ categoryId: food, amount: -3000 },
				{ categoryId: fun, amount: -2000 }
			]
		});
		// a refund, income, a card payment, an off-budget transfer and last month's spending
		createTransaction(db, { accountId: bank, date: '2026-09-11', amount: 1000, categoryId: fun });
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-12',
			amount: 300000,
			categoryId: defaultIncomeCategoryId(db)
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-15',
			amount: -8000,
			transferAccountId: visa
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-16',
			amount: -10000,
			transferAccountId: broker,
			categoryId: fun
		});
		createTransaction(db, { accountId: bank, date: '2026-08-20', amount: -7000, categoryId: food });
	});

	it('sums net spending per category in the date range, largest first, then by name', () => {
		expect(spendingByCategory(db, { from: '2026-09-01', to: '2026-09-30' })).toEqual([
			{ categoryId: categoryId(db, 'Rent'), name: 'Rent', groupName: 'Bills', amount: 120000 },
			{ categoryId: categoryId(db, 'Food'), name: 'Food', groupName: 'Everyday', amount: 11000 },
			{ categoryId: categoryId(db, 'Fun'), name: 'Fun', groupName: 'Everyday', amount: 11000 }
		]);
	});

	it('leaves out categories with more refunds than spending', () => {
		const rows = spendingByCategory(db, { from: '2026-09-11', to: '2026-09-11' });
		expect(rows).toEqual([]);
	});

	it('rejects invalid ranges', () => {
		expect(() => spendingByCategory(db, { from: '2026-09-30', to: '2026-09-01' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(() => spendingByCategory(db, { from: 'x', to: '2026-09-01' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});

describe('netWorth', () => {
	it('tracks every account, on and off budget, month by month', () => {
		createTransaction(db, {
			accountId: visa,
			date: '2026-09-05',
			amount: -10000,
			categoryId: categoryId(db, 'Food')
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-15',
			amount: -60000,
			transferAccountId: visa
		});
		expect(netWorth(db, '2026-10')).toEqual([
			{ month: '2026-08', assets: 300000, debts: -50000, netWorth: 250000 },
			{ month: '2026-09', assets: 240000, debts: 0, netWorth: 240000 },
			{ month: '2026-10', assets: 240000, debts: 0, netWorth: 240000 }
		]);
	});

	it('rejects an invalid month', () => {
		expect(() => netWorth(db, '2026-13')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});

describe('cashFlow', () => {
	beforeEach(() => {
		const income = defaultIncomeCategoryId(db);
		const food = categoryId(db, 'Food');
		const fun = categoryId(db, 'Fun');
		createTransaction(db, {
			accountId: bank,
			date: '2026-08-05',
			amount: 300000,
			categoryId: income
		});
		createTransaction(db, { accountId: bank, date: '2026-08-06', amount: -7000, categoryId: food });
		createTransaction(db, {
			accountId: visa,
			date: '2026-09-05',
			amount: -9000,
			splits: [
				{ categoryId: food, amount: -4000 },
				{ categoryId: income, amount: -1000 },
				{ categoryId: fun, amount: -4000 }
			]
		});
		// a refund, a card payment and an off-budget transfer
		createTransaction(db, { accountId: bank, date: '2026-09-11', amount: 1000, categoryId: fun });
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-15',
			amount: -8000,
			transferAccountId: visa
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-09-16',
			amount: -10000,
			transferAccountId: broker,
			categoryId: fun
		});
		createTransaction(db, { accountId: broker, date: '2026-09-20', amount: 5000 });
	});

	it('sums income and net spending per month, leaving starting balances out', () => {
		expect(cashFlow(db, { from: '2026-08-01', to: '2026-09-30' })).toEqual([
			{ month: '2026-08', income: 300000, spending: 7000 },
			{ month: '2026-09', income: -1000, spending: 17000 }
		]);
	});

	it('keeps to the date range and returns only months with data', () => {
		expect(cashFlow(db, { from: '2026-09-01', to: '2026-12-31' })).toEqual([
			{ month: '2026-09', income: -1000, spending: 17000 }
		]);
		expect(cashFlow(db, { from: '2027-01-01', to: '2027-12-31' })).toEqual([]);
	});

	it('rejects invalid ranges', () => {
		expect(() => cashFlow(db, { from: '2026-09-30', to: '2026-09-01' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});

describe('ageOfMoney', () => {
	let savings: string;

	beforeEach(() => {
		const food = categoryId(db, 'Food');
		const fun = categoryId(db, 'Fun');
		savings = createAccount(db, {
			name: 'Savings',
			type: 'savings',
			onBudget: true,
			startingDate: '2026-08-01',
			startingBalance: -2000,
			startingBalancePayee: 'Saldo inicial'
		});
		createTransaction(db, { accountId: bank, date: '2026-08-10', amount: -8000, categoryId: food });
		createTransaction(db, { accountId: visa, date: '2026-08-11', amount: -9000, categoryId: food });
		// a card payment, a move between cash accounts and one to a tracking account
		createTransaction(db, {
			accountId: bank,
			date: '2026-08-12',
			amount: -9000,
			transferAccountId: visa
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-08-13',
			amount: -20000,
			transferAccountId: savings
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-08-14',
			amount: -10000,
			transferAccountId: broker,
			categoryId: fun
		});
		createTransaction(db, {
			accountId: bank,
			date: '2026-08-15',
			amount: -5000,
			splits: [
				{ categoryId: food, amount: -6000 },
				{ categoryId: fun, amount: 1000 }
			]
		});
		createTransaction(db, { accountId: savings, date: '2026-08-16', amount: 700, categoryId: fun });
		createTransaction(db, { accountId: bank, date: '2026-08-17', amount: 0, categoryId: fun });
		createTransaction(db, { accountId: bank, date: '2026-09-30', amount: -100, categoryId: fun });
	});

	it('takes the money moving in and out of the cash accounts, card payments included', () => {
		const flows = ageOfMoneyFlows(db, '2026-09-01').map(({ date, amount, opening }) => ({
			date,
			amount,
			opening
		}));
		expect(flows.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount)).toEqual([
			{ date: '2026-08-01', amount: -2000, opening: true },
			{ date: '2026-08-01', amount: 200000, opening: true },
			{ date: '2026-08-10', amount: -8000, opening: false },
			{ date: '2026-08-12', amount: -9000, opening: false },
			{ date: '2026-08-14', amount: -10000, opening: false },
			{ date: '2026-08-15', amount: -5000, opening: false },
			{ date: '2026-08-16', amount: 700, opening: false }
		]);
	});

	it('gives the monthly series through today', () => {
		for (let day = 20; day < 30; day++)
			createTransaction(db, {
				accountId: bank,
				date: `2026-09-${day}`,
				amount: -1000,
				categoryId: categoryId(db, 'Fun')
			});
		expect(ageOfMoney(db, '2026-09-29')).toEqual([
			{ month: '2026-08', days: null },
			{ month: '2026-09', days: 55 } // 50 to 59 days: all ten spend the 1 August balance
		]);
	});

	it('rejects an invalid date', () => {
		expect(() => ageOfMoney(db, '2026-09-31')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});
