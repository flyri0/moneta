import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import { configure, one, type Db } from './connection';
import { attachImage, openImage, toImage } from './image';
import { checkInvariants } from './invariants';
import { MIGRATIONS, migrate, schemaVersion } from './migrate';
import { isInitialized } from './repos/meta';

const HEADER = 'SQLite format 3\0';

/** SQLite files start with a fixed header and are made of whole pages (512 bytes at least). */
function looksLikeSqlite(bytes: Uint8Array): boolean {
	if (bytes.length < 512 || bytes.length % 512 !== 0) return false;
	for (let i = 0; i < HEADER.length; i++) if (bytes[i] !== HEADER.charCodeAt(i)) return false;
	return true;
}

/** Whether `PRAGMA integrity_check` passes. */
export function isIntact(db: Db): boolean {
	try {
		return db.selectValues('PRAGMA integrity_check').join() === 'ok';
	} catch {
		return false; // e.g. SQLITE_NOTADB or SQLITE_CORRUPT
	}
}

/**
 * Settings for a database built from a file someone else may have made, from SQLite's "Defense
 * Against The Dark Arts": no triggers, no functions with side effects in the schema, no writes to
 * the schema tables, and a check on every page read.
 */
function harden(sqlite3: Sqlite3Static, db: Db): void {
	const { capi } = sqlite3;
	capi.sqlite3_db_config(db, capi.SQLITE_DBCONFIG_DEFENSIVE, 1, 0);
	capi.sqlite3_db_config(db, capi.SQLITE_DBCONFIG_TRUSTED_SCHEMA, 0, 0);
	capi.sqlite3_db_config(db, capi.SQLITE_DBCONFIG_ENABLE_TRIGGER, 0, 0);
	db.exec('PRAGMA cell_size_check = ON');
}

/** Drops every trigger and view. The app's schema has none, so they came from elsewhere. */
function dropCode(db: Db): void {
	const code = db.selectArrays(
		"SELECT type, name FROM sqlite_master WHERE type IN ('trigger', 'view')"
	) as [string, string][];
	for (const [type, name] of code) db.exec(`DROP ${type.toUpperCase()} IF EXISTS ${quote(name)}`);
}

function quote(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

function tables(db: Db, schema: string): string[] {
	return db.selectValues(
		`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
	) as string[];
}

function columns(db: Db, schema: string, table: string): string[] {
	return db.selectValues(`SELECT name FROM pragma_table_info(?, ?)`, [table, schema]) as string[];
}

/**
 * A new budget made by the migrations, holding the rows of `source`: only the tables and columns
 * the app knows, checked against the rules the app keeps on every write. Whatever else `source`
 * holds (triggers, views, other tables, indexes) stays behind.
 */
function rebuild(sqlite3: Sqlite3Static, source: Db, migrations: readonly string[]): Uint8Array {
	const db = new sqlite3.oo1.DB(':memory:', 'c');
	try {
		harden(sqlite3, db);
		migrate(db, migrations);
		attachImage(sqlite3, db, 'src', toImage(sqlite3, source));
		// Rows go in in any order: references are checked once they all are (checkInvariants).
		db.exec('PRAGMA foreign_keys = OFF');
		db.transaction(() => {
			for (const table of tables(db, 'main')) {
				const wanted = columns(db, 'main', table);
				const found = new Set(columns(db, 'src', table));
				const missing = wanted.find((c) => !found.has(c));
				if (missing) throw new DomainError('BACKUP_DAMAGED', `No ${table}.${missing}`);
				const list = wanted.map(quote).join(', ');
				db.exec(
					`INSERT INTO main.${quote(table)} (${list}) SELECT ${list} FROM src.${quote(table)}`
				);
			}
		});
		db.exec('DETACH src');
		configure(db);
		checkInvariants(db);
		return toImage(sqlite3, db);
	} catch (err) {
		if (err instanceof DomainError) throw err;
		throw new DomainError('BACKUP_DAMAGED', String(err));
	} finally {
		db.close();
	}
}

/**
 * Checks a budget's SQLite image from a backup before it may replace anything: the SQLite
 * header, `PRAGMA integrity_check`, the `meta` table, and a schema version this app knows.
 * Older budgets are migrated. The budget is then rebuilt from the migrations with only the data
 * copied over (`rebuild`), so nothing but rows comes from the file, and those rows must keep the
 * app's rules (`checkInvariants`). Returns the rebuilt file.
 */
export function checkBackup(
	sqlite3: Sqlite3Static,
	bytes: Uint8Array,
	migrations: readonly string[] = MIGRATIONS
): Uint8Array {
	if (!looksLikeSqlite(bytes)) throw new DomainError('BACKUP_DAMAGED');
	let db: Db;
	try {
		db = openImage(sqlite3, bytes);
	} catch {
		throw new DomainError('BACKUP_DAMAGED');
	}
	try {
		harden(sqlite3, db);
		if (!isIntact(db)) throw new DomainError('BACKUP_DAMAGED');
		const hasMeta = one(
			db,
			"SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'meta'"
		);
		if (!hasMeta || schemaVersion(db) < 1) throw new DomainError('BACKUP_NOT_MONETA');
		dropCode(db);
		configure(db);
		migrate(db, migrations);
		if (!isInitialized(db)) throw new DomainError('BACKUP_NOT_MONETA');
		return rebuild(sqlite3, db, migrations);
	} finally {
		db.close();
	}
}
