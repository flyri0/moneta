import { describe, expect, it } from 'vitest';
import { holdPoolLock, type PoolLocks } from './pool-lock';

/** An in-memory stand-in for `navigator.locks`: one exclusive holder per name, a queue behind it. */
function fakeLocks(): PoolLocks & { release(name: string): void; held(name: string): boolean } {
	const holders = new Map<string, () => void>();
	const queues = new Map<string, (() => void)[]>();
	const grant = (name: string) => {
		const next = queues.get(name)?.shift();
		if (next) next();
	};
	return {
		request(name, options, callback) {
			return new Promise((resolve, reject) => {
				const start = () => {
					holders.set(name, () => {
						holders.delete(name);
						grant(name);
					});
					void Promise.resolve(callback({})).then(resolve, reject);
				};
				if (!holders.has(name)) return start();
				const queue = queues.get(name) ?? [];
				queues.set(name, queue);
				queue.push(start);
				options.signal?.addEventListener('abort', () => {
					queue.splice(queue.indexOf(start), 1);
					reject(options.signal!.reason);
				});
			});
		},
		release: (name) => holders.get(name)?.(),
		held: (name) => holders.has(name)
	};
}

describe('holdPoolLock', () => {
	it('takes a free lock and keeps it', async () => {
		const locks = fakeLocks();
		expect(await holdPoolLock(locks, 'pool', 1000)).toBe(true);
		expect(locks.held('pool')).toBe(true);
	});

	it('waits for a worker that is still letting go', async () => {
		const locks = fakeLocks();
		await holdPoolLock(locks, 'pool', 1000);
		const second = holdPoolLock(locks, 'pool', 1000);
		let done = false;
		void second.then(() => (done = true));
		await new Promise((r) => setTimeout(r, 20));
		expect(done).toBe(false);
		locks.release('pool');
		expect(await second).toBe(true);
	});

	it('gives up when the lock stays taken', async () => {
		const locks = fakeLocks();
		await holdPoolLock(locks, 'pool', 1000);
		expect(await holdPoolLock(locks, 'pool', 20)).toBe(false);
	});

	it('goes ahead without Web Locks', async () => {
		expect(await holdPoolLock(undefined, 'pool', 20)).toBe(true);
	});
});
