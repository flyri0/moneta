import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import { configure, one, type Db } from './connection';
import { openImage, toImage } from './image';
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
 * Checks a budget's SQLite image from a backup before it may replace anything: the SQLite
 * header, `PRAGMA integrity_check`, the `meta` table, and a schema version this app knows.
 * Older budgets are migrated. Returns the checked, migrated file. Works on an in-memory copy.
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
		if (!isIntact(db)) throw new DomainError('BACKUP_DAMAGED');
		const hasMeta = one(
			db,
			"SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'meta'"
		);
		if (!hasMeta || schemaVersion(db) < 1) throw new DomainError('BACKUP_NOT_MONETA');
		configure(db);
		migrate(db, migrations);
		if (!isInitialized(db)) throw new DomainError('BACKUP_NOT_MONETA');
		return toImage(sqlite3, db);
	} finally {
		db.close();
	}
}
