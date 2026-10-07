/** The Web Lock a worker holds for as long as it has the OPFS pool. */
export const POOL_LOCK_NAME = 'moneta-opfs';
/** How long a worker waits for another one, from a tab just closed or reloaded, to let go. */
export const POOL_LOCK_TIMEOUT = 10_000;

/** The part of `navigator.locks` this module uses. */
export interface PoolLocks {
	request(
		name: string,
		options: { signal?: AbortSignal },
		callback: (lock: unknown) => Promise<void>
	): Promise<unknown>;
}

/**
 * Takes the pool's lock and keeps it until this worker ends, which releases it. The tab lock
 * alone isn't enough: a reloaded or handed-over tab's worker can still hold the pool's files
 * after its page has let go, and opening the pool then fails, which makes sqlite-wasm try to
 * delete the pool's directory. Resolves false when the lock isn't free within `timeout`; true
 * without Web Locks, where nothing can be coordinated.
 */
export async function holdPoolLock(
	locks: PoolLocks | undefined,
	name = POOL_LOCK_NAME,
	timeout = POOL_LOCK_TIMEOUT
): Promise<boolean> {
	if (!locks) return true;
	const abort = new AbortController();
	const timer = setTimeout(() => abort.abort(), timeout);
	try {
		return await new Promise<boolean>((resolve, reject) => {
			locks
				.request(name, { signal: abort.signal }, () => {
					resolve(true);
					// Never settles: the lock is held until the worker is gone.
					return new Promise<void>(() => {});
				})
				.catch((err: unknown) => (abort.signal.aborted ? resolve(false) : reject(err)));
		});
	} finally {
		clearTimeout(timer);
	}
}
