import { describe, it, expect } from 'vitest';
import { checkBackup } from './backup';
import { openImage, toImage } from './image';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { getMeta } from './repos/meta';
import { createBudgetDb, createTestDb, loadSqlite } from './testing';

async function budgetImage(): Promise<Uint8Array> {
	return toImage(await loadSqlite(), await createBudgetDb());
}

describe('checkBackup', () => {
	it('returns a file that opens as the same budget', async () => {
		const sqlite3 = await loadSqlite();
		const db = openImage(sqlite3, checkBackup(sqlite3, await budgetImage()));
		expect(getMeta(db).name).toBe('Test Budget');
		db.close();
	});

	it('rejects files that are not SQLite databases', async () => {
		const sqlite3 = await loadSqlite();
		const text = new TextEncoder().encode('Date,Payee,Amount\n'.repeat(64));
		expect(() => checkBackup(sqlite3, text)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_SQLITE' })
		);
		const truncated = (await budgetImage()).slice(0, 1000);
		expect(() => checkBackup(sqlite3, truncated)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_SQLITE' })
		);
	});

	it('rejects damaged files', async () => {
		const sqlite3 = await loadSqlite();
		const bytes = await budgetImage();
		bytes.fill(0xff, 4096, 8192);
		expect(() => checkBackup(sqlite3, bytes)).toThrow(
			expect.objectContaining({ code: 'BACKUP_DAMAGED' })
		);
	});

	it('rejects SQLite files that are not Moneta budgets', async () => {
		const sqlite3 = await loadSqlite();
		const other = new sqlite3.oo1.DB(':memory:', 'c');
		other.exec('CREATE TABLE notes (text TEXT)');
		expect(() => checkBackup(sqlite3, toImage(sqlite3, other))).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_MONETA' })
		);
		const neverSetUp = toImage(sqlite3, await createTestDb());
		expect(() => checkBackup(sqlite3, neverSetUp)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_MONETA' })
		);
	});

	it('rejects budgets from a newer app', async () => {
		const sqlite3 = await loadSqlite();
		const db = await createBudgetDb();
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		expect(() => checkBackup(sqlite3, toImage(sqlite3, db))).toThrow(
			expect.objectContaining({ code: 'SCHEMA_TOO_NEW' })
		);
	});

	it('migrates budgets from an older app', async () => {
		const sqlite3 = await loadSqlite();
		const image = checkBackup(sqlite3, await budgetImage(), [
			...MIGRATIONS,
			'CREATE TABLE extra (x INTEGER)'
		]);
		const db = openImage(sqlite3, image);
		expect(schemaVersion(db)).toBe(SCHEMA_VERSION + 1);
		db.close();
	});

	it('accepts files saved in WAL mode', async () => {
		const sqlite3 = await loadSqlite();
		const bytes = await budgetImage();
		bytes.set([2, 2], 18);
		const db = openImage(sqlite3, checkBackup(sqlite3, bytes));
		expect(getMeta(db).name).toBe('Test Budget');
		db.close();
	});
});
