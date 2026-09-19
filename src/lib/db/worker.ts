/// <reference lib="webworker" />
import sqlite3InitModule, { type SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$lib/domain/errors';
import { configure, type Db } from './connection';
import { migrate } from './migrate';
import { createDispatcher } from './dispatcher';
import type { SystemApi } from './api';
import type { CallRequest } from './protocol';

const FILE_NAME = /^[A-Za-z0-9_-]+\.sqlite3$/;

function checkFileName(fileName: string): string {
	if (!FILE_NAME.test(fileName))
		throw new DomainError('INVALID_INPUT', `Bad file name ${fileName}`);
	return `/${fileName}`;
}

const POOL_ATTEMPTS = 5;

async function initPool(): Promise<SAHPoolUtil> {
	let lastError: unknown;
	try {
		const sqlite3 = await sqlite3InitModule();
		// A tab that just handed over may still be letting go of its file handles, so retry briefly.
		// `forceReinitIfPreviouslyFailed` is supported by sqlite-wasm but missing from its types.
		const options = { name: 'moneta', initialCapacity: 12, forceReinitIfPreviouslyFailed: true };
		for (let attempt = 1; attempt <= POOL_ATTEMPTS; attempt++) {
			try {
				return await sqlite3.installOpfsSAHPoolVfs(options);
			} catch (err) {
				lastError = err;
				await new Promise((r) => setTimeout(r, 200 * attempt));
			}
		}
	} catch (err) {
		lastError = err;
	}
	throw new DomainError(
		'STORAGE_UNAVAILABLE',
		lastError instanceof Error ? lastError.message : 'OPFS is not available'
	);
}

const poolReady = initPool();
let db: Db | null = null;
let openName: string | null = null;

function closeDb(): void {
	db?.close();
	db = null;
	openName = null;
}

function makeSystem(pool: SAHPoolUtil): SystemApi {
	return {
		open(fileName) {
			const path = checkFileName(fileName);
			closeDb();
			const next = new pool.OpfsSAHPoolDb(path);
			try {
				configure(next);
				migrate(next);
			} catch (err) {
				next.close();
				throw err;
			}
			db = next;
			openName = fileName;
		},
		close: closeDb,
		listFiles() {
			return pool
				.getFileNames()
				.map((n) => n.replace(/^\//, ''))
				.filter((n) => FILE_NAME.test(n));
		},
		deleteFile(fileName) {
			const path = checkFileName(fileName);
			if (openName === fileName) closeDb();
			pool.unlink(path);
		},
		release() {
			closeDb();
			if (!pool.isPaused()) pool.pauseVfs();
		}
	};
}

const dispatchReady = poolReady.then((pool) =>
	createDispatcher({ system: makeSystem(pool), getDb: () => db })
);

self.onmessage = async (event: MessageEvent<CallRequest>) => {
	const req = event.data;
	try {
		const dispatch = await dispatchReady;
		self.postMessage(await dispatch(req));
	} catch (err) {
		const e = err instanceof DomainError ? err : new DomainError('INTERNAL', String(err));
		self.postMessage({ id: req.id, ok: false, error: { code: e.code, message: e.message } });
	}
};
