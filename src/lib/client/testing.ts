import type { Db } from '$lib/db/connection';
import { createDispatcher } from '$lib/db/dispatcher';
import { createSystem } from '$lib/db/system';
import { loadSqlite, memoryFileStore } from '$lib/db/testing';
import { REGISTRY_KEY, type KeyValueStore } from './registry';
import { createRpcClient, type RpcClient } from './rpc';

/** A Map-backed KeyValueStore, optionally pre-filled with a raw registry value. Test-only. */
export function memoryStore(registry?: string): KeyValueStore & { data: Map<string, string> } {
	const data = new Map<string, string>();
	if (registry !== undefined) data.set(REGISTRY_KEY, registry);
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v),
		removeItem: (k) => void data.delete(k)
	};
}

/**
 * An RPC client talking to the worker's real dispatcher and system calls over a MessageChannel,
 * like the app talks to the worker. Budget "files" are in-memory databases kept in `files`.
 * Test-only.
 */
export async function createTestClient(): Promise<{
	client: RpcClient;
	files: Map<string, Db>;
	close(): void;
}> {
	const sqlite3 = await loadSqlite();
	const store = memoryFileStore(sqlite3);
	const dispatch = createDispatcher(createSystem({ sqlite3, store }));
	const channel = new MessageChannel();
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
	return {
		client: createRpcClient(channel.port1),
		files: store.files,
		close() {
			channel.port1.close();
			channel.port2.close();
			for (const db of store.files.values()) db.close();
		}
	};
}
