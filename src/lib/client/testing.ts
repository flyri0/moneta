import type { Db } from '$lib/db/connection';
import { createDispatcher } from '$lib/db/dispatcher';
import { createTestDb } from '$lib/db/testing';
import { REGISTRY_KEY, type KeyValueStore } from './registry';
import { createRpcClient, type RpcClient } from './rpc';

/** A Map-backed KeyValueStore, optionally pre-filled with a raw registry value. Test-only. */
export function memoryStore(registry?: string): KeyValueStore & { data: Map<string, string> } {
	const data = new Map<string, string>();
	if (registry !== undefined) data.set(REGISTRY_KEY, registry);
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v)
	};
}

/**
 * An RPC client talking to a real dispatcher over a MessageChannel, like the app talks to the
 * worker. Budget "files" are in-memory databases kept in `files`. Test-only.
 */
export function createTestClient(): { client: RpcClient; files: Map<string, Db>; close(): void } {
	const files = new Map<string, Db>();
	let openName: string | null = null;
	const channel = new MessageChannel();
	const dispatch = createDispatcher({
		getDb: () => (openName ? (files.get(openName) ?? null) : null),
		system: {
			async open(name) {
				if (!files.has(name)) files.set(name, await createTestDb());
				openName = name;
			},
			close() {
				openName = null;
			},
			listFiles: () => [...files.keys()],
			deleteFile(name) {
				if (openName === name) openName = null;
				files.get(name)?.close();
				files.delete(name);
			},
			release() {
				openName = null;
			}
		}
	});
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
	return {
		client: createRpcClient(channel.port1),
		files,
		close() {
			channel.port1.close();
			channel.port2.close();
			for (const db of files.values()) db.close();
		}
	};
}
