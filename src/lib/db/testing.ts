import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { configure, type Db } from './connection';
import { migrate } from './migrate';

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
