import { inTransaction, type Db } from './connection';

interface Cache {
	version: number;
	values: Map<string, unknown>;
}

const caches = new WeakMap<Db, Cache>();

/**
 * How many rows this connection has inserted, changed or deleted since it opened: a number that
 * moves on every write and on nothing else. A write rolled back still moves it.
 */
export function dataVersion(db: Db): number {
	return db.selectValue('SELECT total_changes()') as number;
}

/**
 * `fn()`, computed once per version of the data (`dataVersion`): reads that run again with nothing
 * written in between share the result, which callers must not change. Inside a transaction it
 * always computes, since a rollback would put back rows without moving the version.
 */
export function memo<T>(db: Db, key: string, fn: () => T): T {
	if (inTransaction(db)) return fn();
	const version = dataVersion(db);
	let cache = caches.get(db);
	if (!cache || cache.version !== version) {
		cache = { version, values: new Map() };
		caches.set(db, cache);
	}
	if (cache.values.has(key)) return cache.values.get(key) as T;
	const value = fn();
	cache.values.set(key, value);
	return value;
}
