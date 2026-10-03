import { describe, expect, it, vi } from 'vitest';
import { run, tx } from './connection';
import { dataVersion, memo } from './memo';
import { createTestDb } from './testing';

describe('memo', () => {
	it('reuses a value while nothing is written', async () => {
		const db = await createTestDb();
		const fn = vi.fn(() => ({}));
		const first = memo(db, 'k', fn);
		expect(memo(db, 'k', fn)).toBe(first);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('keeps values apart by key and by database', async () => {
		const [a, b] = [await createTestDb(), await createTestDb()];
		expect(memo(a, 'x', () => 1)).toBe(1);
		expect(memo(a, 'y', () => 2)).toBe(2);
		expect(memo(b, 'x', () => 3)).toBe(3);
	});

	it('computes again after a write', async () => {
		const db = await createTestDb();
		const fn = vi.fn(() => db.selectValue('SELECT COUNT(*) FROM payees'));
		expect(memo(db, 'k', fn)).toBe(0);
		run(db, "INSERT INTO payees (id, name) VALUES ('p', 'P')");
		expect(memo(db, 'k', fn)).toBe(1);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('never caches inside a transaction', async () => {
		const db = await createTestDb();
		const fn = vi.fn(() => 1);
		tx(db, () => {
			memo(db, 'k', fn);
			memo(db, 'k', fn);
		});
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('serves no value read before a rollback', async () => {
		const db = await createTestDb();
		const count = () => db.selectValue('SELECT COUNT(*) FROM payees');
		expect(() =>
			tx(db, () => {
				run(db, "INSERT INTO payees (id, name) VALUES ('p', 'P')");
				expect(memo(db, 'k', count)).toBe(1);
				throw new Error('rolled back');
			})
		).toThrow('rolled back');
		expect(memo(db, 'k', count)).toBe(0);
	});
});

describe('dataVersion', () => {
	it('moves only when rows change', async () => {
		const db = await createTestDb();
		const before = dataVersion(db);
		db.selectValue('SELECT COUNT(*) FROM payees');
		run(db, "UPDATE payees SET name = 'x' WHERE id = 'none'");
		expect(dataVersion(db)).toBe(before);
		run(db, "INSERT INTO payees (id, name) VALUES ('p', 'P')");
		expect(dataVersion(db)).toBeGreaterThan(before);
	});
});
