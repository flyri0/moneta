import { REGISTRY_KEY, type KeyValueStore } from './registry';

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
