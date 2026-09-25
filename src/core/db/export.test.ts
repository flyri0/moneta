import { describe, it, expect } from 'vitest';
import { createAccount } from './repos/accounts';
import { defaultIncomeCategoryId } from './repos/meta';
import { createTransaction, listTransactions } from './repos/transactions';
import { categoryId, createBudgetDb } from './testing';
import { exportCsv, exportJson, minorToDecimal, transactionsCsv } from './export';
import { dumpBudget } from './repos/dump';

describe('minorToDecimal', () => {
	it('writes plain decimals with the currency precision', () => {
		expect(minorToDecimal(-123456, 2)).toBe('-1234.56');
		expect(minorToDecimal(5, 2)).toBe('0.05');
		expect(minorToDecimal(-5, 2)).toBe('-0.05');
		expect(minorToDecimal(1500, 0)).toBe('1500');
		expect(minorToDecimal(1, 3)).toBe('0.001');
	});
});

async function sampleBudget() {
	const db = await createBudgetDb();
	const base = { onBudget: true, startingDate: '2026-09-01' };
	const bank = createAccount(db, { ...base, name: 'Bank', type: 'checking', startingBalance: 0 });
	const cash = createAccount(db, { ...base, name: 'Cash', type: 'cash', startingBalance: 0 });
	createTransaction(db, {
		accountId: bank,
		date: '2026-09-03',
		amount: -3000,
		payeeName: 'Market, "Central"',
		memo: 'week',
		splits: [
			{ categoryId: categoryId(db, 'Food'), amount: -2000, memo: 'food' },
			{ categoryId: categoryId(db, 'Fun'), amount: -1000 }
		]
	});
	createTransaction(db, {
		accountId: bank,
		date: '2026-09-02',
		amount: 100000,
		payeeName: '=Employer',
		categoryId: defaultIncomeCategoryId(db),
		cleared: true
	});
	createTransaction(db, {
		accountId: bank,
		date: '2026-09-04',
		amount: -5000,
		transferAccountId: cash
	});

	return db;
}

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);

describe('transactionsCsv', () => {
	it('writes one row per transaction and per split line, oldest first', async () => {
		const db = await sampleBudget();
		const csv = transactionsCsv(listTransactions(db).reverse(), 'BRL');
		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(csv.slice(1).split('\r\n')).toEqual([
			'Date,Account,Payee,Transfer,Category,Memo,Amount,Cleared',
			"2026-09-02,Bank,'=Employer,,Salário,,1000.00,cleared",
			'2026-09-03,Bank,"Market, ""Central""",,Food,food,-20.00,uncleared',
			'2026-09-03,Bank,"Market, ""Central""",,Fun,week,-10.00,uncleared',
			'2026-09-04,Bank,,Cash,,,-50.00,uncleared',
			'2026-09-04,Cash,,Bank,,,50.00,uncleared',
			''
		]);
	});
});

describe('exportCsv / exportJson', () => {
	it('builds the CSV of every transaction, oldest first, as UTF-8', async () => {
		const db = await sampleBudget();
		expect(decode(exportCsv(db))).toBe(transactionsCsv(listTransactions(db).reverse(), 'BRL'));
	});

	it('builds the budget dump as JSON on one line', async () => {
		const db = await sampleBudget();
		const now = new Date('2026-09-25T12:00:00Z');
		const text = decode(exportJson(db, now));
		expect(JSON.parse(text)).toEqual(dumpBudget(db, now));
		expect(text.trimEnd()).not.toContain('\n');
		expect(text.endsWith('\n')).toBe(true);
	});
});
