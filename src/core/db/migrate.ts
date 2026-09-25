import { DomainError } from '$domain/errors';
import type { Db } from './connection';
import init from './migrations/0001_init.sql?raw';
import payeeDefaultCategory from './migrations/0002_payee_default_category.sql?raw';
import schedules from './migrations/0003_schedules.sql?raw';
import payeeIndex from './migrations/0004_transactions_payee_index.sql?raw';
import openingTransactions from './migrations/0005_opening_transactions.sql?raw';

export const MIGRATIONS: readonly string[] = [
	init,
	payeeDefaultCategory,
	schedules,
	payeeIndex,
	openingTransactions
];
export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: Db): number {
	return Number(db.selectValue('PRAGMA user_version'));
}

/**
 * How many rows break each foreign key, keyed `table|parent|fk`. Counted rather than listed by
 * rowid, because rebuilding a table renumbers its rows.
 */
function brokenKeys(db: Db): Map<string, number> {
	const counts = new Map<string, number>();
	for (const [table, , parent, fk] of db.selectArrays('PRAGMA foreign_key_check')) {
		const key = `${table}|${parent}|${fk}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

/**
 * Applies pending migrations in order, each in its own transaction. Foreign keys are off while
 * migrating (SQLite only lets that change outside a transaction), so a migration can rebuild a
 * table without cascading deletes. A migration must not break any foreign key: rows that were
 * already broken before it (from an old restore) don't stop it.
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
				const before = brokenKeys(db);
				db.exec(migrations[v]);
				for (const [key, count] of brokenKeys(db))
					if (count > (before.get(key) ?? 0))
						throw new DomainError('INTERNAL', `Migration ${v + 1} left broken foreign keys`);
				db.exec(`PRAGMA user_version = ${v + 1}`);
			});
		}
	} finally {
		db.exec('PRAGMA foreign_keys = ON');
	}
}
