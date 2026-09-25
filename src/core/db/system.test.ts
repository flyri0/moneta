import { describe, it, expect, vi } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION, schemaVersion } from './migrate';
import { newRecoveryKey } from '$domain/recovery-key';
import { readBackup, writeBackup } from './backup-file';
import { openImage, toImage } from './image';
import { getMeta, initBudget, updateMeta } from './repos/meta';
import { createSystem } from './system';
import { loadSqlite, memoryFileStore, memoryKeyStore } from './testing';

const FILE = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const OTHER = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';
const COPY_PREFIX = 'premigration-budget-0190a000-0000-7000-8000-000000000001-';

async function setup() {
	const sqlite3 = await loadSqlite();
	const store = memoryFileStore(sqlite3);
	return { sqlite3, store, keys: memoryKeyStore(), kdfIterations: 1000 };
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
		// The file, its journal, the open database's journal, and the file still open next to it.
		expect(reserve).toHaveBeenCalledWith(4);
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
const FOURTH = 'budget-0190a000-0000-7000-8000-000000000004.sqlite3';

describe('exportBackup', () => {
	it('writes the budgets, open or not, as one .moneta file', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		const { system } = createSystem({ ...deps, now: () => new Date('2026-09-22T12:00:00Z') });
		await system.open(FILE);
		const { bytes, skipped } = await system.exportBackup([FILE, OTHER]);
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
		const { bytes, skipped } = await createSystem(deps).system.exportBackup([FILE, OTHER]);
		expect(skipped).toEqual([OTHER]);
		expect(readBackup(bytes).budgets.map((b) => b.name)).toEqual(['Home']);
	});

	it('exports a saved copy under the id of its budget', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const upgraded = createSystem({ ...deps, migrations: [...MIGRATIONS, 'SELECT 1'] });
		await upgraded.system.open(FILE);
		const [copy] = upgraded.system.listCopies(FILE);
		const { budgets } = readBackup((await upgraded.system.exportBackup([copy.name])).bytes);
		expect(budgets.map(({ id, name }) => ({ id, name }))).toEqual([{ id: ID, name: 'Home' }]);
	});

	it('refuses files that are not budgets or do not exist', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		for (const name of ['demo.sqlite3', OTHER, '../x'])
			await expect(system.exportBackup([name])).rejects.toMatchObject({ code: 'INVALID_INPUT' });
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
		const { bytes } = await system.exportBackup([FILE, OTHER]);
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
		const [budget] = readBackup((await system.exportBackup([FILE])).bytes).budgets;
		expect(system.inspectBackup(budget.image).budgets).toEqual([
			{ index: 0, id: null, name: 'Home' }
		]);
	});

	it('rejects a backup with a damaged budget', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const [budget] = readBackup((await system.exportBackup([FILE])).bytes).budgets;
		const damaged = budget.image.slice();
		damaged.fill(0xff, 4096, 8192);
		expect(() =>
			system.inspectBackup(writeBackup([{ ...budget, id: ID, name: 'Home', image: damaged }], 'x'))
		).toThrow(expect.objectContaining({ code: 'BACKUP_DAMAGED' }));
	});
});

describe('failures keep the open budget', () => {
	it('keeps the open budget when another one fails to open', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		deps.store.files.get(OTHER)!.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		const { system, getDb } = createSystem(deps);
		await system.open(FILE);
		await expect(system.open(OTHER)).rejects.toMatchObject({ code: 'SCHEMA_TOO_NEW' });
		expect(getMeta(getDb()!).name).toBe('Home');
	});

	it('puts the open budget back when writing a restore over it fails', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system, getDb } = createSystem(deps);
		const { bytes } = await system.exportBackup([FILE]);
		await system.open(FILE);
		updateMeta(getDb()!, { name: 'Changed' });
		const write = deps.store.write.bind(deps.store);
		let failed = false;
		deps.store.write = async (name, image) => {
			if (name !== FILE || failed) return write(name, image);
			failed = true;
			// Like the OPFS pool, a failed import drops the file.
			deps.store.remove(name);
			throw new Error('disk full');
		};
		await expect(system.restoreBackup(bytes, [{ index: 0, file: FILE }])).rejects.toThrow(
			'disk full'
		);
		expect(getMeta(getDb()!).name).toBe('Changed');
		expect(system.listFiles()).toContain(FILE);
	});

	it('tells which budgets were restored when a later one fails', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		const { system } = createSystem(deps);
		const { bytes } = await system.exportBackup([FILE, OTHER]);
		const write = deps.store.write.bind(deps.store);
		deps.store.write = async (name, image) => {
			if (name === FOURTH) throw new Error('disk full');
			return write(name, image);
		};
		const picks = [
			{ index: 0, file: THIRD },
			{ index: 1, file: FOURTH }
		];
		await expect(system.restoreBackup(bytes, picks)).rejects.toMatchObject({
			code: 'RESTORE_PARTIAL',
			details: { restored: [THIRD] }
		});
	});
});

describe('restoreBackup', () => {
	it('adds budgets under the files it is given', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		await seedNamed(deps, OTHER, 'Trip');
		const { system, getDb } = createSystem(deps);
		const { bytes } = await system.exportBackup([FILE, OTHER]);
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
		const { bytes } = await system.exportBackup([FILE]);
		await system.open(FILE);
		updateMeta(getDb()!, { name: 'Changed' });
		await system.restoreBackup(bytes, [{ index: 0, file: FILE }]);
		expect(getDb()).toBeNull();
		await system.open(FILE);
		expect(getMeta(getDb()!).name).toBe('Home');
		const [copy] = system.listCopies(FILE);
		const { budgets } = readBackup((await system.exportBackup([copy.name])).bytes);
		expect(budgets.map((b) => b.name)).toEqual(['Changed']);
	});

	it('checks every budget before writing any', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const [budget] = readBackup((await system.exportBackup([FILE])).bytes).budgets;
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

	it('refuses a budget that breaks the app rules, writing nothing', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const [budget] = readBackup((await system.exportBackup([FILE])).bytes).budgets;
		const edited = openImage(deps.sqlite3, budget.image);
		edited.exec("UPDATE meta SET value = 'ZZZ' WHERE key = 'currency'");
		const bytes = writeBackup(
			[{ id: OTHER_ID, name: 'Trip', image: toImage(deps.sqlite3, edited) }],
			'x'
		);
		edited.close();
		await expect(system.restoreBackup(bytes, [{ index: 0, file: OTHER }])).rejects.toMatchObject({
			code: 'BACKUP_DAMAGED'
		});
		expect(system.listFiles()).toEqual([FILE]);
	});

	it('refuses bad picks, changing nothing', async () => {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		const { bytes } = await system.exportBackup([FILE]);
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

describe('backup encryption', () => {
	const PASSWORD = 'correct horse';
	const RECOVERY = newRecoveryKey();

	async function encrypted() {
		const deps = await setup();
		await seedNamed(deps, FILE, 'Home');
		const { system } = createSystem(deps);
		await system.setBackupEncryption(PASSWORD, RECOVERY);
		return { deps, system };
	}

	it('is off until a password is set', async () => {
		const { system } = createSystem(await setup());
		expect(await system.backupEncryption()).toEqual({ on: false });
		await system.setBackupEncryption(PASSWORD, RECOVERY);
		expect(await system.backupEncryption()).toEqual({ on: true });
	});

	it('encrypts every backup once it is on, without asking for the password', async () => {
		const { system } = await encrypted();
		const { bytes, encrypted: sealed } = await system.exportBackup([FILE]);
		expect(sealed).toBe(true);
		expect(system.isEncryptedBackup(bytes)).toBe(true);
		expect(() => system.inspectBackup(bytes)).toThrow(
			expect.objectContaining({ code: 'BACKUP_ENCRYPTED' })
		);
	});

	it('unlocks a backup with the password or the recovery key, then restores it', async () => {
		const { system } = await encrypted();
		const { bytes } = await system.exportBackup([FILE]);
		for (const secret of [{ password: PASSWORD }, { recoveryKey: RECOVERY }]) {
			const plain = await system.unlockBackup(bytes, secret);
			expect(system.isEncryptedBackup(plain)).toBe(false);
			expect(system.inspectBackup(plain).budgets).toEqual([{ index: 0, id: ID, name: 'Home' }]);
		}
		const plain = await system.unlockBackup(bytes, { password: PASSWORD });
		await system.restoreBackup(plain, [{ index: 0, file: OTHER }]);
		expect(system.listFiles()).toContain(OTHER);
	});

	it('rejects a wrong password or recovery key', async () => {
		const { system } = await encrypted();
		const { bytes } = await system.exportBackup([FILE]);
		await expect(system.unlockBackup(bytes, { password: 'wrong horse' })).rejects.toMatchObject({
			code: 'BACKUP_WRONG_KEY'
		});
		await expect(
			system.unlockBackup(bytes, { recoveryKey: newRecoveryKey() })
		).rejects.toMatchObject({ code: 'BACKUP_WRONG_KEY' });
	});

	it('keeps older backups on the password and recovery key they were made with', async () => {
		const { system } = await encrypted();
		const { bytes: before } = await system.exportBackup([FILE]);
		const newRecovery = newRecoveryKey();
		await system.setBackupEncryption('battery staple', newRecovery);
		const { bytes: after } = await system.exportBackup([FILE]);
		await expect(system.unlockBackup(before, { password: PASSWORD })).resolves.toBeInstanceOf(
			Uint8Array
		);
		await expect(system.unlockBackup(before, { recoveryKey: RECOVERY })).resolves.toBeInstanceOf(
			Uint8Array
		);
		await expect(system.unlockBackup(before, { password: 'battery staple' })).rejects.toMatchObject(
			{ code: 'BACKUP_WRONG_KEY' }
		);
		await expect(system.unlockBackup(after, { password: PASSWORD })).rejects.toMatchObject({
			code: 'BACKUP_WRONG_KEY'
		});
		await expect(system.unlockBackup(after, { recoveryKey: newRecovery })).resolves.toBeInstanceOf(
			Uint8Array
		);
	});

	it('writes plain backups again once it is turned off', async () => {
		const { system } = await encrypted();
		await system.clearBackupEncryption();
		expect(await system.backupEncryption()).toEqual({ on: false });
		const { bytes, encrypted: sealed } = await system.exportBackup([FILE]);
		expect(sealed).toBe(false);
		expect(system.inspectBackup(bytes).budgets).toHaveLength(1);
	});

	it('checks a typed password against the one set on this device', async () => {
		const { system } = await encrypted();
		expect(await system.checkBackupPassword(PASSWORD)).toBe(true);
		expect(await system.checkBackupPassword('wrong horse')).toBe(false);
		await system.clearBackupEncryption();
		expect(await system.checkBackupPassword(PASSWORD)).toBe(false);
	});

	it('refuses a short password or a malformed recovery key, and keeps the old setup', async () => {
		const { system } = await encrypted();
		await expect(system.setBackupEncryption('short', RECOVERY)).rejects.toMatchObject({
			code: 'INVALID_INPUT'
		});
		await expect(system.setBackupEncryption(PASSWORD, 'nope')).rejects.toMatchObject({
			code: 'INVALID_INPUT'
		});
		expect(await system.checkBackupPassword(PASSWORD)).toBe(true);
	});

	it('rejects files that are not backups in unlockBackup', async () => {
		const { system } = createSystem(await setup());
		await expect(
			system.unlockBackup(new Uint8Array(), { password: PASSWORD })
		).rejects.toMatchObject({ code: 'BACKUP_NOT_RECOGNIZED' });
	});
});
