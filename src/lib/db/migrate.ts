import { DomainError } from '$lib/domain/errors';
import type { Db } from './connection';
import init from './migrations/0001_init.sql?raw';

export const MIGRATIONS: readonly string[] = [init];
export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: Db): number {
	return Number(db.selectValue('PRAGMA user_version'));
}

/** Applies pending migrations in order, each in its own transaction. */
export function migrate(db: Db): void {
	const current = schemaVersion(db);
	if (current > SCHEMA_VERSION) {
		throw new DomainError(
			'SCHEMA_TOO_NEW',
			`Database schema ${current} is newer than this app (${SCHEMA_VERSION})`
		);
	}
	for (let v = current; v < SCHEMA_VERSION; v++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[v]);
			db.exec(`PRAGMA user_version = ${v + 1}`);
		});
	}
}
