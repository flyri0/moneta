/// <reference lib="webworker" />
import sqlite3InitModule, { type SAHPoolUtil, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import { createDispatcher } from './dispatcher';
import type { BackupKeys } from './backup-crypto';
import { opfsStore } from './opfs-store';
import { createSystem, type KeyStore } from './system';
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

/** A request's result as a promise. */
function done<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * The backup key in IndexedDB (database `moneta`, store `keys`). A CryptoKey is stored as is, so
 * the non-extractable key never leaves Web Crypto.
 */
function idbKeyStore(): KeyStore {
	const STORE = 'keys';
	const RECORD = 'backup';
	let opened: Promise<IDBDatabase> | null = null;
	function open(): Promise<IDBDatabase> {
		if (!opened) {
			const request = indexedDB.open('moneta', 1);
			request.onupgradeneeded = () => request.result.createObjectStore(STORE);
			opened = done(request);
			opened.catch(() => (opened = null));
		}
		return opened;
	}
	async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
		return (await open()).transaction(STORE, mode).objectStore(STORE);
	}
	return {
		async get() {
			const keys = await done((await store('readonly')).get(RECORD));
			return (keys as BackupKeys | undefined) ?? null;
		},
		async set(keys) {
			await done((await store('readwrite')).put(keys, RECORD));
		},
		async clear() {
			await done((await store('readwrite')).delete(RECORD));
		}
	};
}

const dispatchReady = initPool().then(({ sqlite3, pool }) =>
	createDispatcher(createSystem({ sqlite3, store: opfsStore(pool), keys: idbKeyStore() }))
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
