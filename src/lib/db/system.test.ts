import { describe, it, expect, vi } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { getMeta, initBudget } from './repos/meta';
import { createSystem } from './system';
import { loadSqlite, memoryFileStore } from './testing';

const FILE = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const OTHER = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';
const COPY_PREFIX = 'premigration-budget-0190a000-0000-7000-8000-000000000001-';

async function setup() {
	const sqlite3 = await loadSqlite();
	const store = memoryFileStore(sqlite3);
	return { sqlite3, store };
}

/** Creates FILE as a budget at the current schema version, then closes it. */
async function seedBudget(deps: Awaited<ReturnType<typeof setup>>) {
	const { system, getDb } = createSystem(deps);
	await system.open(FILE);
	initBudget(getDb()!, { name: 'Home', currency: 'BRL', locale: 'pt-BR', groups: [] });
	system.close();
}

/** A clock that moves one minute forward on every call. */
function ticking(start = Date.UTC(2026, 8, 19, 12, 0, 0)) {
	let t = start;
	return () => new Date((t += 60_000));
}

describe('createSystem', () => {
	it('creates and migrates new files, and lists only database files', async () => {
		const deps = await setup();
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		expect(schemaVersion(getDb()!)).toBe(SCHEMA_VERSION);
		deps.store.files.set('notes.txt', deps.store.files.get(FILE)!);
		expect(system.listFiles()).toEqual([FILE]);
	});

	it('rejects file names the pool could not hold', async () => {
		const { system } = createSystem(await setup());
		await expect(system.open('../evil.sqlite3')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
		expect(() => system.deleteFile('x.db')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});

	it('makes room in the pool before opening a file', async () => {
		const deps = await setup();
		const reserve = vi.spyOn(deps.store, 'reserve');
		await createSystem(deps).system.open(FILE);
		expect(reserve).toHaveBeenCalledWith(3);
	});

	it('saves a copy of a budget before migrating it', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system, getDb } = createSystem({
			...deps,
			migrations: [...MIGRATIONS, 'CREATE TABLE extra (x INTEGER)'],
			now: () => new Date('2026-09-19T12:34:56.789Z')
		});
		await system.open(FILE);
		expect(schemaVersion(getDb()!)).toBe(SCHEMA_VERSION + 1);
		const copy = `${COPY_PREFIX}20260919123456789.sqlite3`;
		expect(system.listFiles()).toEqual([FILE, copy]);
		const saved = deps.store.files.get(copy)!;
		expect(schemaVersion(saved)).toBe(SCHEMA_VERSION);
		expect(getMeta(saved).name).toBe('Home');
	});

	it('keeps the three newest copies', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const now = ticking();
		const migrations = [...MIGRATIONS];
		for (let i = 1; i <= 4; i++) {
			migrations.push(`CREATE TABLE extra_${i} (x INTEGER)`);
			const { system } = createSystem({ ...deps, migrations: [...migrations], now });
			await system.open(FILE);
			system.close();
		}
		const copies = [...deps.store.files.keys()].filter((f) => f.startsWith(COPY_PREFIX)).sort();
		expect(copies).toHaveLength(3);
		expect(copies.map((c) => schemaVersion(deps.store.files.get(c)!))).toEqual([
			SCHEMA_VERSION + 1,
			SCHEMA_VERSION + 2,
			SCHEMA_VERSION + 3
		]);
	});

	it('does not copy new or current files', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system } = createSystem(deps);
		await system.open(FILE);
		await system.open(OTHER);
		expect(system.listFiles().sort()).toEqual([FILE, OTHER]);
	});

	it('deletes a budget together with its copies', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const upgraded = createSystem({ ...deps, migrations: [...MIGRATIONS, 'SELECT 1'] });
		await upgraded.system.open(FILE);
		await upgraded.system.open(OTHER);
		upgraded.system.deleteFile(FILE);
		expect(upgraded.system.listFiles()).toEqual([OTHER]);
	});

	it('closes the open file when it is deleted, and on release', async () => {
		const deps = await setup();
		const release = vi.spyOn(deps.store, 'release');
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		system.deleteFile(FILE);
		expect(getDb()).toBeNull();
		await system.open(OTHER);
		system.release();
		expect(getDb()).toBeNull();
		expect(release).toHaveBeenCalledOnce();
	});
});
