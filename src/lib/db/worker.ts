/// <reference lib="webworker" />
import sqlite3InitModule, { type SAHPoolUtil, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$lib/domain/errors';
import { createDispatcher } from './dispatcher';
import { createSystem, type FileStore } from './system';
import type { CallRequest } from './protocol';

const POOL_ATTEMPTS = 5;

async function initPool(): Promise<{ sqlite3: Sqlite3Static; pool: SAHPoolUtil }> {
	let lastError: unknown;
	try {
		const sqlite3 = await sqlite3InitModule();
		// A tab that just handed over may still be letting go of its file handles, so retry briefly.
		// `forceReinitIfPreviouslyFailed` is supported by sqlite-wasm but missing from its types.
		const options = { name: 'moneta', initialCapacity: 12, forceReinitIfPreviouslyFailed: true };
		for (let attempt = 1; attempt <= POOL_ATTEMPTS; attempt++) {
			try {
				return { sqlite3, pool: await sqlite3.installOpfsSAHPoolVfs(options) };
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

/** Budget files in the OPFS SAH pool. Pool paths start with a slash; file names don't. */
function opfsStore(pool: SAHPoolUtil): FileStore {
	return {
		list: () => pool.getFileNames().map((n) => n.replace(/^\//, '')),
		open: (name) => new pool.OpfsSAHPoolDb(`/${name}`),
		close: (db) => db.close(),
		async write(name, bytes) {
			await pool.importDb(`/${name}`, bytes);
		},
		remove(name) {
			pool.unlink(`/${name}`);
		},
		async reserve(count) {
			// The pool only grows on request, and it starts with room for 12 files.
			await pool.reserveMinimumCapacity(pool.getFileCount() + count);
		},
		release() {
			if (!pool.isPaused()) pool.pauseVfs();
		}
	};
}

const dispatchReady = initPool().then(({ sqlite3, pool }) =>
	createDispatcher(createSystem({ sqlite3, store: opfsStore(pool) }))
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
