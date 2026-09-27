import { beforeEach, describe, expect, it } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, run, type Db } from '../connection';
import { createAccount, getAccount } from './accounts';
import {
	getCsvFormat,
	importTransactions,
	previewImport,
	type ImportLine,
	type StatementLine
} from './imports';
import { setPayeeDefaultCategory, getOrCreatePayee } from './payees';
import { createTransaction, getTransaction, listTransactions } from './transactions';

const code = (c: string) => expect.objectContaining({ code: c });

let db: Db;
let bank: string;
let broker: string;
let food: string;
let fun: string;

beforeEach(async () => {
	db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	broker = createAccount(db, { ...base, name: 'Broker', type: 'investment', onBudget: false });
	food = categoryId(db, 'Food');
	fun = categoryId(db, 'Fun');
});

function line(over: Partial<StatementLine> = {}): StatementLine {
	return {
		date: '2026-01-10',
		amount: -4500,
		description: 'Mercado Bom',
		memo: '',
		importId: 'ofx:1',
		...over
	};
}

function toImport(l: StatementLine, over: Partial<ImportLine> = {}): ImportLine {
	return {
		importId: l.importId,
		date: l.date,
		amount: l.amount,
		payeeName: l.description,
		memo: l.memo,
		categoryId: food,
		matchId: null,
		...over
	};
}

describe('previewImport', () => {
	it('offers new lines with the category their payee usually gets', () => {
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-02',
			amount: -100,
			payeeName: 'Mercado Bom',
			categoryId: fun
		});
		const [known, unknown] = previewImport(db, bank, [
			line({ description: '  mercado bom ', date: '2026-02-20' }),
			line({ description: 'Nova Loja', importId: 'ofx:2', date: '2026-02-20' })
		]);
		expect(known).toEqual({
			status: 'new',
			match: null,
			payeeName: 'mercado bom',
			categoryId: fun
		});
		expect(unknown).toMatchObject({ status: 'new', categoryId: null });
	});

	it("prefers the payee's default category", () => {
		setPayeeDefaultCategory(db, getOrCreatePayee(db, 'Mercado Bom')!, food);
		expect(previewImport(db, bank, [line()])[0].categoryId).toBe(food);
	});

	it('suggests no category in an off-budget account', () => {
		setPayeeDefaultCategory(db, getOrCreatePayee(db, 'Mercado Bom')!, food);
		expect(previewImport(db, broker, [line()])[0].categoryId).toBeNull();
	});

	it('matches the closest-dated transaction with the same amount, once each', () => {
		const far = createTransaction(db, {
			...{ accountId: bank, amount: -4500, categoryId: food },
			date: '2026-01-06',
			payeeName: 'Mercado'
		});
		const near = createTransaction(db, {
			...{ accountId: bank, amount: -4500, categoryId: food },
			date: '2026-01-11'
		});
		const [first, second, third] = previewImport(db, bank, [
			line(),
			line({ importId: 'ofx:2' }),
			line({ importId: 'ofx:3' })
		]);
		expect(first).toMatchObject({ status: 'match', match: { id: near, date: '2026-01-11' } });
		expect(second).toMatchObject({
			status: 'match',
			match: { id: far, payeeName: 'Mercado' }
		});
		expect(third.status).toBe('new');
	});

	it('does not match further than four days, another amount or an imported transaction', () => {
		createTransaction(db, { accountId: bank, date: '2026-01-15', amount: -4500, categoryId: food });
		createTransaction(db, { accountId: bank, date: '2026-01-10', amount: -4501, categoryId: food });
		const imported = createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -4500,
			categoryId: food
		});
		run(db, "UPDATE transactions SET import_id = 'csv:old' WHERE id = ?", [imported]);
		expect(previewImport(db, bank, [line()])[0].status).toBe('new');
	});

	it('marks lines imported before, or repeated in the file, as duplicates', () => {
		importTransactions(db, bank, { lines: [toImport(line())] });
		expect(
			previewImport(db, bank, [
				line(),
				line({ importId: 'ofx:2' }),
				line({ importId: 'ofx:2' })
			]).map((p) => p.status)
		).toEqual(['duplicate', 'new', 'duplicate']);
	});

	it('refuses a closed account', () => {
		run(db, 'UPDATE accounts SET closed = 1 WHERE id = ?', [broker]);
		expect(() => previewImport(db, broker, [line()])).toThrow(code('ACCOUNT_CLOSED'));
	});
});

describe('importTransactions', () => {
	it('creates new lines cleared, with their payee, category and import id', () => {
		const result = importTransactions(db, bank, {
			lines: [toImport(line({ memo: 'PIX' }))]
		});
		expect(result).toEqual({ created: 1, matched: 0, skipped: 0 });
		const [t] = listTransactions(db, { accountId: bank });
		expect(t).toMatchObject({
			date: '2026-01-10',
			amount: -4500,
			payeeName: 'Mercado Bom',
			categoryId: food,
			memo: 'PIX',
			cleared: true
		});
		expect(all(db, 'SELECT import_id AS id FROM transactions')).toEqual([{ id: 'ofx:1' }]);
	});

	it('marks a matched transaction imported and cleared, keeping the rest', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-11',
			amount: -4500,
			payeeName: 'Mercado',
			categoryId: fun
		});
		const result = importTransactions(db, bank, { lines: [toImport(line(), { matchId: id })] });
		expect(result).toEqual({ created: 0, matched: 1, skipped: 0 });
		expect(getTransaction(db, id)).toMatchObject({
			date: '2026-01-11',
			payeeName: 'Mercado',
			categoryId: fun,
			cleared: true
		});
		expect(listTransactions(db, { accountId: bank })).toHaveLength(1);
	});

	it('skips lines imported meanwhile, so importing twice adds nothing', () => {
		importTransactions(db, bank, { lines: [toImport(line())] });
		expect(importTransactions(db, bank, { lines: [toImport(line())] })).toEqual({
			created: 0,
			matched: 0,
			skipped: 1
		});
		expect(listTransactions(db, { accountId: bank })).toHaveLength(1);
	});

	it('imports all or nothing', () => {
		expect(() =>
			importTransactions(db, bank, {
				lines: [toImport(line()), toImport(line({ importId: 'ofx:2' }), { categoryId: null })]
			})
		).toThrow(code('CATEGORY_REQUIRED'));
		expect(listTransactions(db, { accountId: bank })).toHaveLength(0);
	});

	it('refuses a match that is gone or already imported', () => {
		expect(() =>
			importTransactions(db, bank, { lines: [toImport(line(), { matchId: 'nope' })] })
		).toThrow(code('NOT_FOUND'));
	});

	it('imports into an off-budget account without categories', () => {
		importTransactions(db, broker, { lines: [toImport(line(), { categoryId: null })] });
		expect(getAccount(db, broker).balance).toBe(-4500);
	});

	it('remembers the CSV format of the account', () => {
		expect(getCsvFormat(db, bank)).toBeNull();
		importTransactions(db, bank, { lines: [], csvFormat: '{"date":0}' });
		expect(getCsvFormat(db, bank)).toBe('{"date":0}');
		importTransactions(db, bank, { lines: [] });
		expect(getCsvFormat(db, bank)).toBe('{"date":0}');
	});
});
