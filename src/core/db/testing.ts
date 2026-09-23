import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { configure, one, type Db } from './connection';
import { openImage } from './image';
import { migrate } from './migrate';
import { initBudget } from './repos/meta';
import type { BackupKeys } from './backup-crypto';
import type { FileStore, KeyStore } from './system';

let sqlite: Promise<Sqlite3Static> | undefined;

/**
 * The SQLite module shared by every test helper. Databases only work with the module that
 * created them, so tests must not load their own. Test-only.
 */
export function loadSqlite(): Promise<Sqlite3Static> {
	sqlite ??= sqlite3InitModule();
	return sqlite;
}

/** A fresh, migrated in-memory database. Test-only. */
export async function createTestDb(): Promise<Db> {
	const s = await loadSqlite();
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

/**
 * A FileStore whose files are in-memory databases, kept in `files`. Closing a file keeps its
 * database (it *is* the file). Test-only.
 */
export function memoryFileStore(sqlite3: Sqlite3Static): FileStore & { files: Map<string, Db> } {
	const files = new Map<string, Db>();
	return {
		files,
		list: () => [...files.keys()],
		open(name) {
			let db = files.get(name);
			if (!db) {
				db = new sqlite3.oo1.DB(':memory:', 'c');
				files.set(name, db);
			}
			return db;
		},
		close() {},
		async write(name, bytes) {
			files.get(name)?.close();
			files.set(name, openImage(sqlite3, bytes));
		},
		remove(name) {
			files.get(name)?.close();
			files.delete(name);
		},
		async reserve() {},
		release() {}
	};
}

/** A KeyStore that keeps the backup key in memory. Test-only. */
export function memoryKeyStore(): KeyStore {
	let current: BackupKeys | null = null;
	return {
		async get() {
			return current;
		},
		async set(keys) {
			current = keys;
		},
		async clear() {
			current = null;
		}
	};
}
