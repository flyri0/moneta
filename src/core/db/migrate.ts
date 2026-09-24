import { DomainError } from '$domain/errors';
import type { Db } from './connection';
import init from './migrations/0001_init.sql?raw';
import payeeDefaultCategory from './migrations/0002_payee_default_category.sql?raw';

export const MIGRATIONS: readonly string[] = [init, payeeDefaultCategory];
export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: Db): number {
	return Number(db.selectValue('PRAGMA user_version'));
}

/**
 * Applies pending migrations in order, each in its own transaction. Foreign keys are off while
 * migrating (SQLite only lets that change outside a transaction), so a migration can rebuild a
 * table without cascading deletes. Each migration must leave `PRAGMA foreign_key_check` clean.
 */
export function migrate(db: Db, migrations: readonly string[] = MIGRATIONS): void {
	const current = schemaVersion(db);
	const target = migrations.length;
	if (current > target) {
		throw new DomainError(
			'SCHEMA_TOO_NEW',
			`Database schema ${current} is newer than this app (${target})`
		);
	}
	if (current === target) return;
	db.exec('PRAGMA foreign_keys = OFF');
	try {
		for (let v = current; v < target; v++) {
			db.transaction(() => {
				db.exec(migrations[v]);
				if (db.selectArrays('PRAGMA foreign_key_check').length > 0)
					throw new DomainError('INTERNAL', `Migration ${v + 1} left broken foreign keys`);
				db.exec(`PRAGMA user_version = ${v + 1}`);
			});
		}
	} finally {
		db.exec('PRAGMA foreign_keys = ON');
	}
}
