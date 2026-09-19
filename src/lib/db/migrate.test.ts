import { describe, it, expect } from 'vitest';
import { createTestDb } from './testing';
import { migrate, schemaVersion, SCHEMA_VERSION } from './migrate';
import { all } from './connection';

describe('migrate', () => {
	it('creates the schema and records the version', async () => {
		const db = await createTestDb();
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
		const tables = all<{ name: string }>(
			db,
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
		).map((t) => t.name);
		expect(tables).toEqual([
			'accounts',
			'budget_assignments',
			'categories',
			'category_groups',
			'meta',
			'payees',
			'transaction_splits',
			'transactions'
		]);
	});

	it('is idempotent', async () => {
		const db = await createTestDb();
		migrate(db);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
	});

	it('refuses databases from a newer app version', async () => {
		const db = await createTestDb();
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		expect(() => migrate(db)).toThrow(expect.objectContaining({ code: 'SCHEMA_TOO_NEW' }));
	});

	it('enforces foreign keys', async () => {
		const db = await createTestDb();
		expect(() =>
			db.exec("INSERT INTO categories (id, group_id, name) VALUES ('c', 'missing-group', 'Food')")
		).toThrow(/FOREIGN KEY/);
	});
});
