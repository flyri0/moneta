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
import { createRule } from './payee-rules';
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
			importId: 'ofx:1',
			match: null,
			payeeName: 'mercado bom',
			categoryId: fun,
			ruleId: null
		});
		expect(unknown).toMatchObject({ status: 'new', categoryId: null });
	});

	it("prefers the payee's default category", () => {
		setPayeeDefaultCategory(db, getOrCreatePayee(db, 'Mercado Bom')!, food);
		expect(previewImport(db, bank, [line()])[0].categoryId).toBe(food);
	});

	it("gives a rule's payee and category to the lines it catches", () => {
		const rule = createRule(db, {
			payeeName: 'Uber',
			kind: 'starts',
			text: 'UBER',
			categoryId: fun
		});
		const [caught, other] = previewImport(db, bank, [
			line({ description: 'UBER *TRIP 8H2K' }),
			line({ description: 'Padaria', importId: 'ofx:2' })
		]);
		expect(caught).toMatchObject({ payeeName: 'Uber', categoryId: fun, ruleId: rule });
		expect(other).toMatchObject({ payeeName: 'Padaria', ruleId: null });
	});

	it("falls back to the rule payee's usual category", () => {
		createRule(db, { payeeName: 'Uber', kind: 'starts', text: 'UBER', categoryId: null });
		setPayeeDefaultCategory(db, getOrCreatePayee(db, 'Uber')!, food);
		expect(previewImport(db, bank, [line({ description: 'UBER *EATS' })])[0]).toMatchObject({
			payeeName: 'Uber',
			categoryId: food
		});
		expect(previewImport(db, broker, [line({ description: 'UBER *EATS' })])[0]).toMatchObject({
			payeeName: 'Uber',
			categoryId: null
		});
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
		expect(previewImport(db, bank, [line()])[0]).toMatchObject({
			status: 'possible',
			match: { date: '2026-01-15' }
		});
	});

	it('offers a same-amount transaction up to ten days off as a possible match', () => {
		const paycheck = createTransaction(db, {
			accountId: bank,
			date: '2026-01-16',
			amount: -4500,
			payeeName: 'Mercado',
			categoryId: food
		});
		const [p] = previewImport(db, bank, [line()]);
		expect(p).toEqual({
			status: 'possible',
			importId: 'ofx:1',
			match: { id: paycheck, date: '2026-01-16', payeeName: 'Mercado', memo: '' },
			payeeName: 'Mercado Bom',
			categoryId: null,
			ruleId: null
		});
	});

	it('offers no possible match for the other sign, another amount or past ten days', () => {
		createTransaction(db, { accountId: bank, date: '2026-01-12', amount: 4500, categoryId: fun });
		createTransaction(db, { accountId: bank, date: '2026-01-12', amount: -4501, categoryId: food });
		createTransaction(db, { accountId: bank, date: '2026-01-21', amount: -4500, categoryId: food });
		expect(previewImport(db, bank, [line()])[0]).toMatchObject({ status: 'new', match: null });
	});

	it('gives exact matches first, so a looser candidate never takes one', () => {
		const t = createTransaction(db, {
			accountId: bank,
			date: '2026-01-12',
			amount: -4500,
			categoryId: food
		});
		const [early, close] = previewImport(db, bank, [
			line({ date: '2026-01-03' }),
			line({ date: '2026-01-11', importId: 'ofx:2' })
		]);
		expect(close).toMatchObject({ status: 'match', match: { id: t } });
		expect(early).toMatchObject({ status: 'new', match: null });
	});

	it('links a possible match on import', () => {
		const t = createTransaction(db, {
			accountId: bank,
			date: '2026-01-16',
			amount: -4500,
			categoryId: food
		});
		const [p] = previewImport(db, bank, [line()]);
		importTransactions(db, bank, { lines: [toImport(line(), { matchId: p.match!.id })] });
		expect(getTransaction(db, t)).toMatchObject({ cleared: true });
		expect(previewImport(db, bank, [line()])[0].status).toBe('duplicate');
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

	it('imports a bank id used again for another line under an id of its own', () => {
		const statement = [
			line({ date: '2026-01-05', amount: -1000 }),
			line({ date: '2026-01-20', amount: -99999 })
		];
		const previews = previewImport(db, bank, statement);
		expect(previews.map((p) => [p.status, p.importId])).toEqual([
			['new', 'ofx:1'],
			['new', 'ofx:1:2026-01-20:-99999']
		]);
		importTransactions(db, bank, {
			lines: statement.map((l, i) => toImport({ ...l, importId: previews[i].importId }))
		});
		expect(previewImport(db, bank, statement).map((p) => p.status)).toEqual([
			'duplicate',
			'duplicate'
		]);
	});

	it('takes a bank id seen again with the same amount, a few days off, as the same line', () => {
		importTransactions(db, bank, { lines: [toImport(line({ date: '2026-01-10' }))] });
		expect(previewImport(db, bank, [line({ date: '2026-01-12' })])[0].status).toBe('duplicate');
		expect(previewImport(db, bank, [line({ amount: -1 })])[0]).toMatchObject({
			status: 'new',
			importId: 'ofx:1:2026-01-10:-1'
		});
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
