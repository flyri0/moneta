import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import { checkBackup, isIntact } from './backup';
import { createKeys, openKey, type BackupKeys } from './backup-crypto';
import {
	isSealed,
	openSealed,
	readBackup,
	sealBackup,
	writeBackup,
	type BackupBudget
} from './backup-file';
import { configure, type Db } from './connection';
import { openImage, toImage } from './image';
import { MIGRATIONS, migrate, schemaVersion } from './migrate';
import { getMeta, updateMeta } from './repos/meta';
import type { RestorePick, SystemApi } from './api';

/** Where database files live: the OPFS SAH pool in the worker, in-memory databases in tests. */
export interface FileStore {
	/** File names, without a leading slash. */
	list(): string[];
	/** Opens a file, creating an empty database if it doesn't exist. */
	open(name: string): Db;
	close(db: Db): void;
	/** Creates or replaces a file with the bytes of a `.sqlite` file. */
	write(name: string, bytes: Uint8Array): Promise<void>;
	remove(name: string): void;
	/** Makes sure `count` more files fit next to the ones that exist now. */
	reserve(count: number): Promise<void>;
	/** Lets go of the storage so another tab can open it. */
	release(): void;
}

/**
 * Where the backup key of this device lives: IndexedDB in the worker, memory in tests. Null
 * means backups aren't encrypted.
 */
export interface KeyStore {
	get(): Promise<BackupKeys | null>;
	set(keys: BackupKeys): Promise<void>;
	clear(): Promise<void>;
}

export interface SystemDeps {
	sqlite3: Sqlite3Static;
	store: FileStore;
	keys: KeyStore;
	migrations?: readonly string[];
	now?: () => Date;
	/** PBKDF2 iterations for a new backup password; tests use fewer. */
	kdfIterations?: number;
}

const FILE_NAME = /^[A-Za-z0-9_-]+\.sqlite3$/;
/** Room kept before creating a file: the file, its journal and the open database's journal. */
const SPARE_FILES = 3;
const KEPT_COPIES = 3;

function checkFileName(fileName: string): void {
	if (!FILE_NAME.test(fileName))
		throw new DomainError('INVALID_INPUT', `Bad file name ${fileName}`);
}

/** `premigration-<file>-<stamp>.sqlite3`, the stamp being the UTC time it was saved. */
const COPY_NAME =
	/^premigration-[A-Za-z0-9_-]+-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})\.sqlite3$/;
/** A budget file, `budget-<id>.sqlite3`, or one of its copies. The id is what a backup keeps. */
const BUDGET_ID = /^(?:premigration-)?budget-([0-9a-f-]+?)(?:-\d{17})?\.sqlite3$/;

/** `budget-<id>.sqlite3` → `premigration-budget-<id>-`, the prefix of its pre-migration copies. */
function copyPrefix(fileName: string): string {
	return `premigration-${fileName.replace(/\.sqlite3$/, '')}-`;
}

/** When a copy was saved, as an ISO date, from its name. */
function copySavedAt(name: string): string {
	const [, y, mo, d, h, mi, s, ms] = COPY_NAME.exec(name)!;
	return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}

/** The worker's file operations over any FileStore. */
export function createSystem(deps: SystemDeps): { system: SystemApi; getDb: () => Db | null } {
	const { sqlite3, store, keys } = deps;
	const migrations = deps.migrations ?? MIGRATIONS;
	const now = deps.now ?? (() => new Date());
	let db: Db | null = null;
	let openName: string | null = null;

	function closeDb(): void {
		if (db) store.close(db);
		db = null;
		openName = null;
	}

	function copiesOf(fileName: string): string[] {
		const prefix = copyPrefix(fileName);
		return store
			.list()
			.filter((n) => n.startsWith(prefix) && COPY_NAME.test(n))
			.sort();
	}

	/** Saves `image` as a timestamped copy of `fileName` and keeps only the newest few. */
	async function saveCopy(fileName: string, image: Uint8Array): Promise<void> {
		const stamp = now().toISOString().replace(/\D/g, '');
		await store.write(`${copyPrefix(fileName)}${stamp}.sqlite3`, image);
		for (const old of copiesOf(fileName).slice(0, -KEPT_COPIES)) store.remove(old);
	}

	/** Removes a budget file and its copies, closing it first if it is the open one. */
	function removeFile(fileName: string): void {
		if (openName === fileName) closeDb();
		store.remove(fileName);
		for (const copy of copiesOf(fileName)) store.remove(copy);
	}

	/** The bytes of a budget file, whether or not it is the open one. */
	function readImage(fileName: string): Uint8Array {
		return withFile(fileName, (file) => toImage(sqlite3, file));
	}

	/** Runs `fn` on a file: the open database when it is that file, else the file opened for it. */
	function withFile<T>(fileName: string, fn: (file: Db) => T): T {
		if (db && openName === fileName) return fn(db);
		const file = store.open(fileName);
		try {
			return fn(file);
		} finally {
			store.close(file);
		}
	}

	/** The id a backup keeps for a budget file or copy that exists, or INVALID_INPUT. */
	function backupId(name: string): string {
		const id = BUDGET_ID.exec(name)?.[1];
		if (!id || !store.list().includes(name))
			throw new DomainError('INVALID_INPUT', `No budget file named ${name}`);
		return id;
	}

	/** A budget file or copy as it goes into a backup, or null when it can't be read. */
	function backupBudget(name: string): BackupBudget | null {
		const id = backupId(name);
		try {
			const image = readImage(name);
			const copy = openImage(sqlite3, image);
			try {
				if (!isIntact(copy)) return null;
				return { id, name: getMeta(copy).name, image };
			} finally {
				copy.close();
			}
		} catch (err) {
			console.warn(`Moneta couldn't back up ${name}`, err);
			return null;
		}
	}

	function checkPicks(picks: RestorePick[], count: number): void {
		const files = new Set<string>();
		for (const pick of picks) {
			const { index, file } = (pick ?? {}) as Partial<RestorePick>;
			if (!Number.isInteger(index) || index! < 0 || index! >= count || typeof file !== 'string')
				throw new DomainError('INVALID_INPUT', 'Bad restore pick');
			checkFileName(file);
			if (files.has(file)) throw new DomainError('INVALID_INPUT', `${file} picked twice`);
			files.add(file);
		}
	}

	const system: SystemApi = {
		async open(fileName) {
			checkFileName(fileName);
			closeDb();
			await store.reserve(SPARE_FILES);
			const next = store.open(fileName);
			try {
				configure(next);
				const version = schemaVersion(next);
				if (version > 0 && version < migrations.length)
					await saveCopy(fileName, toImage(sqlite3, next));
				migrate(next, migrations);
			} catch (err) {
				store.close(next);
				throw err;
			}
			db = next;
			openName = fileName;
		},
		close: closeDb,
		listFiles() {
			return store.list().filter((n) => FILE_NAME.test(n));
		},
		deleteFile(fileName) {
			checkFileName(fileName);
			removeFile(fileName);
		},
		listCopies(fileName) {
			checkFileName(fileName);
			return copiesOf(fileName)
				.reverse()
				.map((name) => ({ name, savedAt: copySavedAt(name) }));
		},
		readCopy(copyName) {
			if (!COPY_NAME.test(copyName) || !store.list().includes(copyName))
				throw new DomainError('INVALID_INPUT', `No copy named ${copyName}`);
			const copy = store.open(copyName);
			try {
				return toImage(sqlite3, copy);
			} finally {
				store.close(copy);
			}
		},
		release() {
			closeDb();
			store.release();
		},
		async exportBackup(names) {
			const budgets: BackupBudget[] = [];
			const skipped: string[] = [];
			for (const name of names) {
				const budget = backupBudget(name);
				if (budget) budgets.push(budget);
				else skipped.push(name);
			}
			const bytes = writeBackup(budgets, now().toISOString());
			const key = await keys.get();
			if (!key) return { bytes, skipped, encrypted: false };
			return { bytes: await sealBackup(bytes, key), skipped, encrypted: true };
		},
		async backupEncryption() {
			return { on: (await keys.get()) !== null };
		},
		async setBackupEncryption(password, recoveryKey) {
			await keys.set(await createKeys(password, recoveryKey, deps.kdfIterations));
		},
		clearBackupEncryption() {
			return keys.clear();
		},
		async checkBackupPassword(password) {
			const current = await keys.get();
			if (!current) return false;
			try {
				await openKey(current.slots, { password });
				return true;
			} catch (err) {
				if (err instanceof DomainError && err.code === 'BACKUP_WRONG_KEY') return false;
				throw err;
			}
		},
		isEncryptedBackup(bytes) {
			return isSealed(bytes);
		},
		unlockBackup(bytes, secret) {
			return openSealed(bytes, secret);
		},
		markBackedUp(fileNames, at) {
			for (const fileName of fileNames) {
				backupId(fileName);
				try {
					withFile(fileName, (file) => updateMeta(file, { lastBackupAt: at }));
				} catch (err) {
					console.warn(`Moneta couldn't mark ${fileName} as backed up`, err);
				}
			}
		},
		inspectBackup(bytes) {
			const { createdAt, budgets } = readBackup(bytes);
			return {
				createdAt,
				budgets: budgets.map(({ id, image }, index) => {
					const db = openImage(sqlite3, checkBackup(sqlite3, image, migrations));
					try {
						return { index, id, name: getMeta(db).name };
					} finally {
						db.close();
					}
				})
			};
		},
		async restoreBackup(bytes, picks) {
			if (!Array.isArray(picks)) throw new DomainError('INVALID_INPUT', 'Bad restore picks');
			const { budgets } = readBackup(bytes);
			checkPicks(picks, budgets.length);
			// Everything is checked before anything is written, so a bad backup changes nothing.
			const images = picks.map(({ index }) =>
				checkBackup(sqlite3, budgets[index].image, migrations)
			);
			await store.reserve(SPARE_FILES + 2 * picks.length);
			const existing = new Set(store.list());
			for (const { file } of picks) if (existing.has(file)) await saveCopy(file, readImage(file));
			for (const [i, { file }] of picks.entries()) {
				if (openName === file) closeDb();
				await store.write(file, images[i]);
			}
		}
	};
	return { system, getDb: () => db };
}
