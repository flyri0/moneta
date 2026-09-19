import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { configure, one, type Db } from './connection';
import { migrate } from './migrate';
import { initBudget } from './repos/meta';

let sqlite: Promise<Sqlite3Static> | undefined;

/** A fresh, migrated in-memory database. Test-only. */
export async function createTestDb(): Promise<Db> {
	sqlite ??= sqlite3InitModule();
	const s = await sqlite;
	const db = new s.oo1.DB(':memory:', 'c');
	configure(db);
	migrate(db);
	return db;
}

/** A migrated database with an initialized BRL budget: Bills (Rent, Utilities), Everyday (Food, Fun). */
export async function createBudgetDb(): Promise<Db> {
	const db = await createTestDb();
	initBudget(db, {
		name: 'Test Budget',
		currency: 'BRL',
		locale: 'pt-BR',
		groups: [
			{ name: 'Bills', categories: ['Rent', 'Utilities'] },
			{ name: 'Everyday', categories: ['Food', 'Fun'] }
		]
	});
	return db;
}

/** Looks up a category id by name (test convenience). */
export function categoryId(db: Db, name: string): string {
	const row = one<{ id: string }>(db, 'SELECT id FROM categories WHERE name = ?', [name]);
	if (!row) throw new Error(`No category named ${name}`);
	return row.id;
}
