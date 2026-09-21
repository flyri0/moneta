import { describe, it, expect } from 'vitest';
import { createTestDb } from './testing';
import { MIGRATIONS, migrate, schemaVersion, SCHEMA_VERSION } from './migrate';
import { all, run } from './connection';

/** Rebuilds `categories` (the SQLite way to change a column), which other tables reference. */
const REBUILD_CATEGORIES = `
CREATE TABLE categories_new (
	id TEXT PRIMARY KEY,
	group_id TEXT NOT NULL REFERENCES category_groups (id),
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
	carryover_overspending INTEGER NOT NULL DEFAULT 0 CHECK (carryover_overspending IN (0, 1)),
	note TEXT NOT NULL DEFAULT ''
);
INSERT INTO categories_new (id, group_id, name, sort_order, hidden, carryover_overspending)
	SELECT id, group_id, name, sort_order, hidden, carryover_overspending FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
`;

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

	it('rebuilds a referenced table without cascading deletes', async () => {
		const db = await createTestDb();
		run(db, "INSERT INTO category_groups (id, name) VALUES ('g1', 'Everyday')");
		run(db, "INSERT INTO categories (id, group_id, name) VALUES ('c1', 'g1', 'Food')");
		run(
			db,
			"INSERT INTO budget_assignments (category_id, month, assigned) VALUES ('c1', '2026-09', 500)"
		);
		migrate(db, [...MIGRATIONS, REBUILD_CATEGORIES]);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION + 1);
		expect(all(db, 'SELECT assigned FROM budget_assignments')).toEqual([{ assigned: 500 }]);
		expect(db.selectValue('PRAGMA foreign_keys')).toBe(1);
	});

	it('rolls back a migration that breaks foreign keys', async () => {
		const db = await createTestDb();
		run(db, "INSERT INTO category_groups (id, name) VALUES ('g1', 'Everyday')");
		run(db, "INSERT INTO categories (id, group_id, name) VALUES ('c1', 'g1', 'Food')");
		expect(() => migrate(db, [...MIGRATIONS, 'DELETE FROM category_groups'])).toThrow(
			expect.objectContaining({ code: 'INTERNAL' })
		);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
		expect(db.selectValue('SELECT count(*) FROM category_groups')).toBeGreaterThan(0);
		expect(db.selectValue('PRAGMA foreign_keys')).toBe(1);
	});

	it('enforces foreign keys', async () => {
		const db = await createTestDb();
		expect(() =>
			db.exec("INSERT INTO categories (id, group_id, name) VALUES ('c', 'missing-group', 'Food')")
		).toThrow(/FOREIGN KEY/);
	});

	it('rejects credit_card_payments as category group system type', async () => {
		const db = await createTestDb();
		expect(() =>
			run(
				db,
				"INSERT INTO category_groups (id, name, system) VALUES ('g', 'CC', 'credit_card_payments')"
			)
		).toThrow();
	});

	it('creates categories table without cc_account_id or system columns', async () => {
		const db = await createTestDb();
		const cols = all<{ name: string }>(db, 'PRAGMA table_info(categories)').map((c) => c.name);
		expect(cols).toContain('carryover_overspending');
		expect(cols).not.toContain('cc_account_id');
		expect(cols).not.toContain('system');
	});
});
