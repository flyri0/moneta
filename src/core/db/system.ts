import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import { checkBackup } from './backup';
import { configure, type Db } from './connection';
import { toImage } from './image';
import { MIGRATIONS, migrate, schemaVersion } from './migrate';
import type { SystemApi } from './api';

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

export interface SystemDeps {
	sqlite3: Sqlite3Static;
	store: FileStore;
	migrations?: readonly string[];
	now?: () => Date;
}

const FILE_NAME = /^[A-Za-z0-9_-]+\.sqlite3$/;
/** Room kept before creating a file: the file, its journal and the open database's journal. */
const SPARE_FILES = 3;
const KEPT_COPIES = 3;

function checkFileName(fileName: string): void {
	if (!FILE_NAME.test(fileName))
		throw new DomainError('INVALID_INPUT', `Bad file name ${fileName}`);
}

/** `budget-<id>.sqlite3` → `premigration-budget-<id>-`, the prefix of its pre-migration copies. */
function copyPrefix(fileName: string): string {
	return `premigration-${fileName.replace(/\.sqlite3$/, '')}-`;
}

/** The worker's file operations over any FileStore. */
export function createSystem(deps: SystemDeps): { system: SystemApi; getDb: () => Db | null } {
	const { sqlite3, store } = deps;
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
			.filter((n) => n.startsWith(prefix))
			.sort();
	}

	/** Saves `current` as a timestamped copy of `fileName` and keeps only the newest few. */
	async function saveCopy(fileName: string, current: Db): Promise<void> {
		const stamp = now().toISOString().replace(/\D/g, '');
		await store.write(`${copyPrefix(fileName)}${stamp}.sqlite3`, toImage(sqlite3, current));
		for (const old of copiesOf(fileName).slice(0, -KEPT_COPIES)) store.remove(old);
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
				if (version > 0 && version < migrations.length) await saveCopy(fileName, next);
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
			if (openName === fileName) closeDb();
			store.remove(fileName);
			for (const copy of copiesOf(fileName)) store.remove(copy);
		},
		release() {
			closeDb();
			store.release();
		},
		exportFile() {
			if (!db) throw new DomainError('NO_DATABASE_OPEN');
			return toImage(sqlite3, db);
		},
		async importFile(fileName, bytes) {
			checkFileName(fileName);
			if (store.list().includes(fileName))
				throw new DomainError('INVALID_INPUT', `${fileName} already exists`);
			const image = checkBackup(sqlite3, bytes, migrations);
			await store.reserve(SPARE_FILES);
			await store.write(fileName, image);
		}
	};
	return { system, getDb: () => db };
}
