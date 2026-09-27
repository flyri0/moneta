import { beforeEach, describe, expect, it } from 'vitest';
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { categoryId, createBudgetDb, loadSqlite } from './testing';
import { ALL_TABLES, all, run, tx, type Db } from './connection';
import { applyInverse, record } from './undo';
import { createAccount } from './repos/accounts';
import { moveMoney, setAssigned } from './repos/budget';
import { importTransactions } from './repos/imports';
import { deletePayee } from './repos/payees';
import { createTransaction, deleteTransaction, updateTransaction } from './repos/transactions';

const code = (c: string) => expect.objectContaining({ code: c });

let sqlite3: Sqlite3Static;
let db: Db;
let bank: string;
let savings: string;
let food: string;
let fun: string;

beforeEach(async () => {
	sqlite3 = await loadSqlite();
	db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	savings = createAccount(db, { ...base, name: 'Savings', type: 'savings' });
	food = categoryId(db, 'Food');
	fun = categoryId(db, 'Fun');
});

/** Every row of every table, in a stable order. */
function snapshot(db: Db): Record<string, unknown[]> {
	return Object.fromEntries(
		ALL_TABLES.map((t) => [t, all(db, `SELECT * FROM ${t} ORDER BY 1, 2`)])
	);
}

/** Runs `fn` the way the dispatcher runs an undoable write. */
function recorded<T>(fn: () => T) {
	return tx(db, () => record(sqlite3, db, fn));
}

function undo(inverse: Uint8Array): void {
	tx(db, () => applyInverse(sqlite3, db, inverse));
}

describe('record and applyInverse', () => {
	it('brings back a deleted split transaction and a deleted transfer pair', () => {
		const split = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -3000,
			payeeName: 'Market',
			splits: [
				{ categoryId: food, amount: -2000, memo: 'bread' },
				{ categoryId: fun, amount: -1000 }
			]
		});
		const transfer = createTransaction(db, {
			accountId: bank,
			date: '2026-01-06',
			amount: -5000,
			transferAccountId: savings
		});
		const before = snapshot(db);

		const first = recorded(() => deleteTransaction(db, split));
		const second = recorded(() => deleteTransaction(db, transfer));
		expect(snapshot(db)).not.toEqual(before);

		undo(second.inverse);
		undo(first.inverse);
		expect(snapshot(db)).toEqual(before);
	});

	it('returns what the write returned', () => {
		const { result } = recorded(() => 42);
		expect(result).toBe(42);
	});

	it('takes back moved money, including a row the move created', () => {
		setAssigned(db, food, '2026-01', 10000);
		const before = snapshot(db);
		const { inverse } = recorded(() =>
			moveMoney(db, { fromCategoryId: food, toCategoryId: fun, month: '2026-01', amount: 2500 })
		);
		undo(inverse);
		expect(snapshot(db)).toEqual(before);
	});

	it('takes back an import, so the same lines can be imported again', () => {
		const before = snapshot(db);
		const input = {
			lines: [
				{
					importId: 'ofx:1',
					date: '2026-01-10',
					amount: -4500,
					payeeName: 'Brand New Payee',
					memo: '',
					categoryId: food,
					matchId: null
				}
			],
			csvFormat: '{"x":1}'
		};
		const { inverse } = recorded(() => importTransactions(db, bank, input));
		undo(inverse);
		expect(snapshot(db)).toEqual(before);
		expect(importTransactions(db, bank, input)).toMatchObject({ created: 1 });
	});

	it('refuses when a row it would restore was changed since, and changes nothing', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -3000,
			categoryId: food
		});
		const { inverse } = recorded(() =>
			updateTransaction(db, id, {
				accountId: bank,
				date: '2026-01-05',
				amount: -4000,
				categoryId: food
			})
		);
		updateTransaction(db, id, {
			accountId: bank,
			date: '2026-01-05',
			amount: -5000,
			categoryId: food
		});
		const before = snapshot(db);
		expect(() => undo(inverse)).toThrow(code('UNDO_CONFLICT'));
		expect(snapshot(db)).toEqual(before);
	});

	it('refuses when a row it would restore points at something deleted since', () => {
		const id = createTransaction(db, {
			accountId: bank,
			date: '2026-01-05',
			amount: -3000,
			payeeName: 'Once',
			categoryId: food
		});
		const payee = all<{ id: string }>(db, "SELECT id FROM payees WHERE name = 'Once'")[0].id;
		const { inverse } = recorded(() => deleteTransaction(db, id));
		deletePayee(db, payee);
		const before = snapshot(db);
		expect(() => undo(inverse)).toThrow(code('UNDO_CONFLICT'));
		expect(snapshot(db)).toEqual(before);
	});

	it('records nothing for changes rolled back inside the write', () => {
		const { inverse } = recorded(() => {
			try {
				tx(db, () => {
					run(db, "INSERT INTO payees (id, name) VALUES ('p', 'Gone')");
					throw new Error('roll back');
				});
			} catch {
				// expected
			}
		});
		const before = snapshot(db);
		undo(inverse);
		expect(snapshot(db)).toEqual(before);
	});
});
