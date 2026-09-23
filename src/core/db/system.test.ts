import { describe, it, expect, vi } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { readBackup, writeBackup } from './backup-file';
import { getMeta, initBudget, updateMeta } from './repos/meta';
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

describe('listCopies / readCopy', () => {
	/** Opens FILE with one more migration, so a copy is saved, then closes it. */
	async function upgrade(
		deps: Awaited<ReturnType<typeof setup>>,
		extra: string[],
		now: () => Date
	) {
		const { system } = createSystem({ ...deps, migrations: [...MIGRATIONS, ...extra], now });
		await system.open(FILE);
		system.close();
	}

	it('lists the copies of a budget, newest first, with when they were saved', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const now = ticking();
		await upgrade(deps, ['CREATE TABLE a (x INTEGER)'], now);
		await upgrade(deps, ['CREATE TABLE a (x INTEGER)', 'CREATE TABLE b (x INTEGER)'], now);
		const { system } = createSystem(deps);
		expect(system.listCopies(FILE)).toEqual([
			{ name: `${COPY_PREFIX}20260919120200000.sqlite3`, savedAt: '2026-09-19T12:02:00.000Z' },
			{ name: `${COPY_PREFIX}20260919120100000.sqlite3`, savedAt: '2026-09-19T12:01:00.000Z' }
		]);
		expect(system.listCopies(OTHER)).toEqual([]);
	});

	it('reads a copy as a backup that restores the budget as it was', async () => {
		const deps = await setup();
		await seedBudget(deps);
		await upgrade(deps, ['CREATE TABLE a (x INTEGER)'], ticking());
		const { system, getDb } = createSystem(deps);
		const [copy] = system.listCopies(FILE);
		await system.restoreBackup(system.readCopy(copy.name), [{ index: 0, file: OTHER }]);
		await system.open(OTHER);
		expect(getMeta(getDb()!).name).toBe('Home');
		expect(system.listCopies(FILE)).toHaveLength(1);
	});

	it('reads only pre-migration copies that exist', async () => {
		const deps = await setup();
		await seedBudget(deps);
		const { system } = createSystem(deps);
		expect(() => system.readCopy(FILE)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
		expect(() => system.readCopy(`${COPY_PREFIX}1.sqlite3`)).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(system.listFiles()).toEqual([FILE]);
	});
});

/** Opens `file`, makes it a budget named `name`, and closes it. */
async function seedNamed(deps: Awaited<ReturnType<typeof setup>>, file: string, name: string) {
	const { system, getDb } = createSystem(deps);
	await system.open(file);
	initBudget(getDb()!, { name, currency: 'BRL', locale: 'pt-BR', groups: [] });
	system.close();
}

const ID = '0190a000-0000-7000-8000-000000000001';
const OTHER_ID = '0190a000-0000-7000-8000-000000000002';
const THIRD = 'budget-0190a000-0000-7000-8000-000000000003.sqlite3';

describe('exportBackup', () => {
	it('writes the budgets, open or not, as one .moneta file', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		const { system } = createSystem({ ...deps, now: () => new Date('2026-09-22T12:00:00Z') });
		await system.open(FILE);
		const { bytes, skipped } = system.exportBackup([FILE, OTHER]);
		expect(skipped).toEqual([]);
		const contents = readBackup(bytes);
		expect(contents.createdAt).toBe('2026-09-22T12:00:00.000Z');
		expect(contents.budgets.map(({ id, name }) => ({ id, name }))).toEqual([
			{ id: ID, name: 'Home' },
			{ id: OTHER_ID, name: 'Trip' }
		]);
	});

	it('leaves out files it cannot read, and names them', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		// Created but never initialized, as an interrupted onboarding leaves it.
		await createSystem(deps).system.open(OTHER);
		const { bytes, skipped } = createSystem(deps).system.exportBackup([FILE, OTHER]);
		expect(skipped).toEqual([OTHER]);
		expect(readBackup(bytes).budgets.map((b) => b.name)).toEqual(['Home']);
	});

	it('exports a saved copy under the id of its budget', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const upgraded = createSystem({ ...deps, migrations: [...MIGRATIONS, 'SELECT 1'] });
		await upgraded.system.open(FILE);
		const [copy] = upgraded.system.listCopies(FILE);
		const { budgets } = readBackup(upgraded.system.exportBackup([copy.name]).bytes);
		expect(budgets.map(({ id, name }) => ({ id, name }))).toEqual([{ id: ID, name: 'Home' }]);
	});

	it('refuses files that are not budgets or do not exist', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		for (const name of ['demo.sqlite3', OTHER, '../x'])
			expect(() => system.exportBackup([name])).toThrow(
				expect.objectContaining({ code: 'INVALID_INPUT' })
			);
		expect(system.listFiles()).toEqual([FILE]);
	});
});

describe('markBackedUp', () => {
	it('stamps every budget, open or not, and skips the ones it cannot write', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		await createSystem(deps).system.open(THIRD);
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		system.markBackedUp([FILE, OTHER, THIRD], '2026-09-22T12:00:00.000Z');
		expect(getMeta(getDb()!).lastBackupAt).toBe('2026-09-22T12:00:00.000Z');
		expect(getMeta(deps.store.files.get(OTHER)!).lastBackupAt).toBe('2026-09-22T12:00:00.000Z');
	});
});

describe('inspectBackup', () => {
	it('lists the budgets in a backup without writing anything', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		const { system } = createSystem(deps);
		const { bytes } = system.exportBackup([FILE, OTHER]);
		system.deleteFile(OTHER);
		expect(system.inspectBackup(bytes)).toEqual({
			createdAt: expect.any(String),
			budgets: [
				{ index: 0, id: ID, name: 'Home' },
				{ index: 1, id: OTHER_ID, name: 'Trip' }
			]
		});
		expect(system.listFiles()).toEqual([FILE]);
	});

	it('reads a legacy .sqlite backup as one budget without an id', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const [budget] = readBackup(system.exportBackup([FILE]).bytes).budgets;
		expect(system.inspectBackup(budget.image).budgets).toEqual([
			{ index: 0, id: null, name: 'Home' }
		]);
	});

	it('rejects a backup with a damaged budget', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const [budget] = readBackup(system.exportBackup([FILE]).bytes).budgets;
		const damaged = budget.image.slice();
		damaged.fill(0xff, 4096, 8192);
		expect(() =>
			system.inspectBackup(writeBackup([{ ...budget, id: ID, name: 'Home', image: damaged }], 'x'))
		).toThrow(expect.objectContaining({ code: 'BACKUP_DAMAGED' }));
	});
});

describe('restoreBackup', () => {
	it('adds budgets under the files it is given', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		const { system, getDb } = createSystem(deps);
		const { bytes } = system.exportBackup([FILE, OTHER]);
		system.deleteFile(FILE);
		system.deleteFile(OTHER);
		await system.restoreBackup(bytes, [{ index: 1, file: THIRD }]);
		expect(system.listFiles()).toEqual([THIRD]);
		await system.open(THIRD);
		expect(getMeta(getDb()!).name).toBe('Trip');
	});

	it('replaces an existing budget, keeping it as a saved copy, even when it is open', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system, getDb } = createSystem({ ...deps, now: ticking() });
		const { bytes } = system.exportBackup([FILE]);
		await system.open(FILE);
		updateMeta(getDb()!, { name: 'Changed' });
		await system.restoreBackup(bytes, [{ index: 0, file: FILE }]);
		expect(getDb()).toBeNull();
		await system.open(FILE);
		expect(getMeta(getDb()!).name).toBe('Home');
		const [copy] = system.listCopies(FILE);
		const { budgets } = readBackup(system.exportBackup([copy.name]).bytes);
		expect(budgets.map((b) => b.name)).toEqual(['Changed']);
	});

	it('checks every budget before writing any', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const [budget] = readBackup(system.exportBackup([FILE]).bytes).budgets;
		const damaged = budget.image.slice();
		damaged.fill(0xff, 4096, 8192);
		const bytes = writeBackup(
			[
				{ id: OTHER_ID, name: 'Trip', image: budget.image },
				{ id: ID, name: 'Home', image: damaged }
			],
			'x'
		);
		const picks = [
			{ index: 0, file: OTHER },
			{ index: 1, file: FILE }
		];
		await expect(system.restoreBackup(bytes, picks)).rejects.toMatchObject({
			code: 'BACKUP_DAMAGED'
		});
		expect(system.listFiles()).toEqual([FILE]);
		expect(system.listCopies(FILE)).toEqual([]);
	});

	it('refuses bad picks, changing nothing', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const { bytes } = system.exportBackup([FILE]);
		const bad = [
			[{ index: 1, file: OTHER }],
			[{ index: 0, file: '../x' }],
			[{ index: '0', file: OTHER }],
			[
				{ index: 0, file: OTHER },
				{ index: 0, file: OTHER }
			],
			['x']
		];
		for (const picks of bad)
			await expect(system.restoreBackup(bytes, picks as never)).rejects.toMatchObject({
				code: 'INVALID_INPUT'
			});
		expect(system.listFiles()).toEqual([FILE]);
	});
});
