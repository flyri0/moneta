import { describe, it, expect } from 'vitest';
import { checkBackup } from './backup';
import { openImage, toImage } from './image';
import { all, type Db } from './connection';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { createAccount } from './repos/accounts';
import { setAssigned } from './repos/budget';
import { dumpBudget } from './repos/dump';
import { getMeta } from './repos/meta';
import { createSchedule } from './repos/schedules';
import { createTransaction } from './repos/transactions';
import { categoryId, createBudgetDb, createTestDb, loadSqlite } from './testing';

async function budgetImage(): Promise<Uint8Array> {
	return toImage(await loadSqlite(), await createBudgetDb());
}

describe('checkBackup', () => {
	it('returns a file that opens as the same budget', async () => {
		const sqlite3 = await loadSqlite();
		const db = openImage(sqlite3, checkBackup(sqlite3, await budgetImage()));
		expect(getMeta(db).name).toBe('Test Budget');
		db.close();
	});

	it('rejects images that are not SQLite databases as damaged', async () => {
		const sqlite3 = await loadSqlite();
		const text = new TextEncoder().encode('Date,Payee,Amount\n'.repeat(64));
		expect(() => checkBackup(sqlite3, text)).toThrow(
			expect.objectContaining({ code: 'BACKUP_DAMAGED' })
		);
		const truncated = (await budgetImage()).slice(0, 1000);
		expect(() => checkBackup(sqlite3, truncated)).toThrow(
			expect.objectContaining({ code: 'BACKUP_DAMAGED' })
		);
	});

	it('rejects damaged files', async () => {
		const sqlite3 = await loadSqlite();
		const bytes = await budgetImage();
		bytes.fill(0xff, 4096, 8192);
		expect(() => checkBackup(sqlite3, bytes)).toThrow(
			expect.objectContaining({ code: 'BACKUP_DAMAGED' })
		);
	});

	it('rejects SQLite files that are not Moneta budgets', async () => {
		const sqlite3 = await loadSqlite();
		const other = new sqlite3.oo1.DB(':memory:', 'c');
		other.exec('CREATE TABLE notes (text TEXT)');
		expect(() => checkBackup(sqlite3, toImage(sqlite3, other))).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_MONETA' })
		);
		const neverSetUp = toImage(sqlite3, await createTestDb());
		expect(() => checkBackup(sqlite3, neverSetUp)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_MONETA' })
		);
	});

	it('rejects budgets from a newer app', async () => {
		const sqlite3 = await loadSqlite();
		const db = await createBudgetDb();
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		expect(() => checkBackup(sqlite3, toImage(sqlite3, db))).toThrow(
			expect.objectContaining({ code: 'SCHEMA_TOO_NEW' })
		);
	});

	it('migrates budgets from an older app', async () => {
		const sqlite3 = await loadSqlite();
		const image = checkBackup(sqlite3, await budgetImage(), [
			...MIGRATIONS,
			'CREATE TABLE extra (x INTEGER)'
		]);
		const db = openImage(sqlite3, image);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION + 1);
		db.close();
	});

	it('accepts files saved in WAL mode', async () => {
		const sqlite3 = await loadSqlite();
		const bytes = await budgetImage();
		bytes.set([2, 2], 18);
		const db = openImage(sqlite3, checkBackup(sqlite3, bytes));
		expect(getMeta(db).name).toBe('Test Budget');
		db.close();
	});
});

/**
 * A budget with one of everything a restore checks: a plain transaction, a split, a transfer, a
 * split schedule and an assignment.
 */
async function fullBudget(): Promise<Db> {
	const db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2026-01-01' };
	const bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	const savings = createAccount(db, { ...base, name: 'Savings', type: 'savings' });
	const food = categoryId(db, 'Food');
	const fun = categoryId(db, 'Fun');
	createTransaction(db, {
		accountId: bank,
		date: '2026-01-05',
		amount: -1000,
		categoryId: food,
		memo: 'plain'
	});
	const splits = [
		{ categoryId: food, amount: -600 },
		{ categoryId: fun, amount: -400 }
	];
	createTransaction(db, {
		accountId: bank,
		date: '2026-01-06',
		amount: -1000,
		splits,
		memo: 'split'
	});
	createTransaction(db, {
		accountId: bank,
		date: '2026-01-07',
		amount: -500,
		transferAccountId: savings,
		memo: 'move'
	});
	createSchedule(db, {
		accountId: bank,
		amount: -1000,
		payeeName: 'Market',
		splits,
		startDate: '2026-02-01',
		frequency: 'monthly',
		interval: 1,
		endDate: null,
		endCount: null,
		weekend: 'keep',
		autoEnter: false
	});
	setAssigned(db, food, '2026-01', 5000);
	return db;
}

/** The image of `fullBudget` after `sql` ran on it with no constraints, as a hand-edited file. */
async function tampered(sql: string): Promise<Uint8Array> {
	const db = await fullBudget();
	db.exec('PRAGMA foreign_keys = OFF; PRAGMA ignore_check_constraints = ON');
	db.exec(sql);
	return toImage(await loadSqlite(), db);
}

function schemaOf(db: Db) {
	return all(
		db,
		"SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"
	);
}

describe('checkBackup rebuilds the budget', () => {
	it('restores a valid budget exactly as it was', async () => {
		const sqlite3 = await loadSqlite();
		const original = await fullBudget();
		const restored = openImage(sqlite3, checkBackup(sqlite3, toImage(sqlite3, original)));
		const at = new Date('2026-09-25T00:00:00Z');
		expect(dumpBudget(restored, at)).toEqual(dumpBudget(original, at));
		restored.close();
	});

	it('keeps which transactions are starting balances', async () => {
		const sqlite3 = await loadSqlite();
		const db = await createBudgetDb();
		createAccount(db, {
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 1000,
			startingDate: '2026-01-01'
		});
		const restored = openImage(sqlite3, checkBackup(sqlite3, toImage(sqlite3, db)));
		expect(all(restored, 'SELECT amount, is_opening FROM transactions')).toEqual([
			{ amount: 1000, is_opening: 1 }
		]);
		restored.close();
	});

	it('keeps only the app schema: no triggers, views or extra tables', async () => {
		const sqlite3 = await loadSqlite();
		const image = await tampered(`
			CREATE TRIGGER evil AFTER INSERT ON transactions BEGIN DELETE FROM transactions; END;
			CREATE VIEW peek AS SELECT * FROM transactions;
			CREATE TABLE extra (x);
			CREATE INDEX extra_x ON extra (x);`);
		const restored = openImage(sqlite3, checkBackup(sqlite3, image));
		expect(schemaOf(restored)).toEqual(schemaOf(await createTestDb()));
		restored.close();
	});

	const broken: [string, string][] = [
		[
			'a transaction whose account is gone',
			"UPDATE transactions SET account_id = 'gone' WHERE memo = 'plain'"
		],
		['a text amount', "UPDATE transactions SET amount = 'abc' WHERE memo = 'plain'"],
		['a fractional amount', "UPDATE transactions SET amount = 12.5 WHERE memo = 'plain'"],
		[
			'a split with a text amount',
			"UPDATE transaction_splits SET amount = 'x' WHERE amount = -600"
		],
		['a text assignment', "UPDATE budget_assignments SET assigned = 'x'"],
		['a fractional schedule amount', 'UPDATE schedules SET amount = 0.5'],
		['a date that is not a date', "UPDATE transactions SET date = 'zzzz' WHERE memo = 'plain'"],
		['an impossible date', "UPDATE transactions SET date = '2026-13-45' WHERE memo = 'plain'"],
		['a far-off year', "UPDATE transactions SET date = '9999-12-31' WHERE memo = 'plain'"],
		['a bad schedule start', "UPDATE schedules SET start_date = '=HYPERLINK()'"],
		['a bad schedule end', "UPDATE schedules SET end_date = 'soon'"],
		['a bad month', "UPDATE budget_assignments SET month = '2026-13'"],
		[
			'splits that do not add up',
			'UPDATE transaction_splits SET amount = amount - 1 WHERE amount = -600'
		],
		[
			'schedule splits that do not add up',
			'UPDATE schedule_splits SET amount = amount - 1 WHERE amount = -600'
		],
		['a split transaction without splits', 'DELETE FROM transaction_splits'],
		[
			'splits on a transaction that is not split',
			"UPDATE transactions SET is_split = 0, category_id = NULL WHERE memo = 'split'"
		],
		[
			'a transfer without its other half',
			"UPDATE transactions SET transfer_id = NULL WHERE memo = 'move' AND amount < 0"
		],
		[
			'a transfer whose halves do not match',
			"UPDATE transactions SET amount = 1 WHERE memo = 'move' AND amount > 0"
		],
		['an unknown currency', "UPDATE meta SET value = 'ZZZ' WHERE key = 'currency'"],
		['an invalid locale', "UPDATE meta SET value = 'not a locale!!' WHERE key = 'locale'"],
		['an empty name', "UPDATE meta SET value = '  ' WHERE key = 'name'"],
		['a creation date that is not a date', "UPDATE meta SET value = 'x' WHERE key = 'created_at'"],
		[
			'a last backup that is not a date',
			"INSERT INTO meta (key, value) VALUES ('last_backup_at', 'not a date')"
		],
		['a boolean that is not 0 or 1', "UPDATE transactions SET cleared = 7 WHERE memo = 'plain'"]
	];
	for (const [what, sql] of broken) {
		it(`rejects ${what} as damaged`, async () => {
			const sqlite3 = await loadSqlite();
			const image = await tampered(sql);
			expect(() => checkBackup(sqlite3, image)).toThrow(
				expect.objectContaining({ code: 'BACKUP_DAMAGED' })
			);
		});
	}

	it('rejects a budget that misses a table as damaged', async () => {
		const sqlite3 = await loadSqlite();
		const image = await tampered('DROP TABLE schedule_splits');
		expect(() => checkBackup(sqlite3, image)).toThrow(
			expect.objectContaining({ code: 'BACKUP_DAMAGED' })
		);
	});
});
