import { describe, it, expect, beforeEach } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { run, tx, type Db } from '../connection';
import { createAccount } from './accounts';
import { createTransaction, getTransaction } from './transactions';
import {
	deletePayee,
	deleteUnusedPayees,
	getOrCreatePayee,
	listPayees,
	mergePayee,
	renamePayee,
	setPayeeDefaultCategory
} from './payees';

const code = (c: string) => expect.objectContaining({ code: c });

let db: Db;
let bank: string;
let food: string;
let fun: string;

beforeEach(async () => {
	db = await createBudgetDb();
	bank = createAccount(db, {
		name: 'Bank',
		type: 'checking',
		onBudget: true,
		startingBalance: 100000,
		startingDate: '2026-01-01'
	});
	food = categoryId(db, 'Food');
	fun = categoryId(db, 'Fun');
});

function spend(payeeName: string, date = '2026-01-10', category = food): string {
	return createTransaction(db, {
		accountId: bank,
		date,
		amount: -1000,
		payeeName,
		categoryId: category
	});
}

const payee = (name: string) => listPayees(db).find((p) => p.name === name)!;

describe('listPayees', () => {
	it('counts transactions and gives the last use and the default category', () => {
		spend('Mercado', '2026-01-10');
		spend('Mercado', '2026-02-03', fun);
		getOrCreatePayee(db, 'Unused');
		setPayeeDefaultCategory(db, payee('Mercado').id, food);
		expect(listPayees(db)).toEqual([
			expect.objectContaining({
				name: 'Mercado',
				transactions: 2,
				lastUsed: '2026-02-03',
				defaultCategoryId: food,
				lastCategoryId: fun
			}),
			expect.objectContaining({ name: 'Starting Balance', transactions: 1 }),
			expect.objectContaining({
				name: 'Unused',
				transactions: 0,
				lastUsed: null,
				defaultCategoryId: null,
				lastCategoryId: null
			})
		]);
	});
});

describe('listPayees on a long history', () => {
	it('lists 500 payees over 30,000 transactions quickly', () => {
		tx(db, () => {
			for (let p = 0; p < 500; p++)
				run(db, 'INSERT INTO payees (id, name) VALUES (?, ?)', [`p${p}`, `Payee ${p}`]);
			for (let t = 0; t < 30_000; t++) {
				const day = String((t % 28) + 1).padStart(2, '0');
				const month = String((t % 12) + 1).padStart(2, '0');
				run(
					db,
					`INSERT INTO transactions (id, account_id, date, amount, payee_id, category_id)
					 VALUES (?, ?, ?, -100, ?, ?)`,
					[`t${t}`, bank, `20${10 + (t % 16)}-${month}-${day}`, `p${t % 500}`, food]
				);
			}
		});
		const start = performance.now();
		const payees = listPayees(db);
		const elapsed = performance.now() - start;
		expect(payees.find((p) => p.name === 'Payee 7')?.lastCategoryId).toBe(food);
		expect(elapsed).toBeLessThan(500);
	});
});

describe('renamePayee', () => {
	it('renames the payee on every past transaction', () => {
		const a = spend('Amzn');
		const b = spend('Amzn', '2026-01-20');
		renamePayee(db, payee('Amzn').id, '  Amazon ');
		expect(getTransaction(db, a).payeeName).toBe('Amazon');
		expect(getTransaction(db, b).payeeName).toBe('Amazon');
	});

	it('allows changing only the case of its own name', () => {
		spend('amazon');
		renamePayee(db, payee('amazon').id, 'Amazon');
		expect(payee('Amazon')).toBeDefined();
	});

	it('refuses a blank name or one another payee has', () => {
		spend('Amazon');
		spend('Mercado');
		const id = payee('Mercado').id;
		expect(() => renamePayee(db, id, '  ')).toThrow(code('INVALID_INPUT'));
		expect(() => renamePayee(db, id, 'AMAZON')).toThrow(code('PAYEE_EXISTS'));
		expect(() => renamePayee(db, 'missing', 'X')).toThrow(code('NOT_FOUND'));
	});

	it('keeps starting balance payees as they are', () => {
		spend('Mercado');
		expect(() => renamePayee(db, payee('Starting Balance').id, 'Opening')).toThrow(
			code('SYSTEM_ENTITY_READONLY')
		);
		expect(() => renamePayee(db, payee('Mercado').id, 'Saldo inicial')).toThrow(
			code('SYSTEM_ENTITY_READONLY')
		);
	});
});

describe('mergePayee', () => {
	it('moves the transactions to the target and deletes the source', () => {
		const t = spend('Amzn');
		spend('Amazon');
		const source = payee('Amzn').id;
		const target = payee('Amazon').id;
		mergePayee(db, source, target);
		expect(getTransaction(db, t).payeeName).toBe('Amazon');
		expect(listPayees(db).some((p) => p.id === source)).toBe(false);
		expect(payee('Amazon').transactions).toBe(2);
	});

	it("keeps the target's default category, or takes the source's when it has none", () => {
		spend('A');
		spend('B');
		spend('C');
		setPayeeDefaultCategory(db, payee('A').id, fun);
		setPayeeDefaultCategory(db, payee('B').id, food);
		mergePayee(db, payee('A').id, payee('B').id);
		expect(payee('B').defaultCategoryId).toBe(food);
		mergePayee(db, payee('B').id, payee('C').id);
		expect(payee('C').defaultCategoryId).toBe(food);
	});

	it('refuses merging into itself, a missing payee or a starting balance', () => {
		spend('Mercado');
		const id = payee('Mercado').id;
		const opening = payee('Starting Balance').id;
		expect(() => mergePayee(db, id, id)).toThrow(code('INVALID_INPUT'));
		expect(() => mergePayee(db, id, 'missing')).toThrow(code('NOT_FOUND'));
		expect(() => mergePayee(db, id, opening)).toThrow(code('SYSTEM_ENTITY_READONLY'));
		expect(() => mergePayee(db, opening, id)).toThrow(code('SYSTEM_ENTITY_READONLY'));
	});
});

describe('setPayeeDefaultCategory', () => {
	it('sets and clears the default category', () => {
		spend('Mercado');
		const id = payee('Mercado').id;
		setPayeeDefaultCategory(db, id, fun);
		expect(payee('Mercado').defaultCategoryId).toBe(fun);
		setPayeeDefaultCategory(db, id);
		expect(payee('Mercado').defaultCategoryId).toBeNull();
	});

	it('refuses a missing category or a starting balance payee', () => {
		spend('Mercado');
		expect(() => setPayeeDefaultCategory(db, payee('Mercado').id, 'missing')).toThrow(
			code('NOT_FOUND')
		);
		expect(() => setPayeeDefaultCategory(db, payee('Starting Balance').id, food)).toThrow(
			code('SYSTEM_ENTITY_READONLY')
		);
	});
});

describe('deleting payees', () => {
	it('deletes an unused payee and refuses one in use', () => {
		spend('Mercado');
		const unused = getOrCreatePayee(db, 'Unused')!;
		deletePayee(db, unused);
		expect(listPayees(db).some((p) => p.id === unused)).toBe(false);
		expect(() => deletePayee(db, payee('Mercado').id)).toThrow(code('PAYEE_IN_USE'));
		expect(() => deletePayee(db, 'missing')).toThrow(code('NOT_FOUND'));
	});

	it('deletes every unused payee except starting balances', () => {
		spend('Mercado');
		getOrCreatePayee(db, 'Old');
		getOrCreatePayee(db, 'Older');
		getOrCreatePayee(db, 'Saldo inicial');
		expect(deleteUnusedPayees(db)).toBe(2);
		expect(listPayees(db).map((p) => p.name)).toEqual([
			'Mercado',
			'Saldo inicial',
			'Starting Balance'
		]);
	});
});
