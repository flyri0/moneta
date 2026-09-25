import { describe, it, expect } from 'vitest';
import { createTabLock, type ChannelLike, type LockManagerLike } from './tab-lock';

/** An in-memory Web Locks manager: one holder per name, FIFO waiters, `signal` and `steal`. */
function fakeLocks(): LockManagerLike {
	const holders = new Map<string, { abort(err: unknown): void }>();
	const waiting = new Map<string, (() => void)[]>();
	const grant = (name: string, callback: (lock: unknown) => Promise<void> | void) =>
		new Promise((resolve, reject) => {
			const holder = { abort: reject };
			holders.set(name, holder);
			Promise.resolve(callback({ name }))
				.then(resolve, reject)
				.finally(() => {
					if (holders.get(name) !== holder) return;
					holders.delete(name);
					waiting.get(name)?.shift()?.();
				});
		});
	return {
		request(name, options, callback) {
			if (options.steal) {
				holders.get(name)?.abort(new DOMException('Lock stolen', 'AbortError'));
				holders.delete(name);
				return grant(name, callback);
			}
			if (!holders.has(name)) return grant(name, callback);
			if (options.ifAvailable) return Promise.resolve(callback(null));
			return new Promise((resolve, reject) => {
				const queue = waiting.get(name) ?? [];
				const go = () => resolve(grant(name, callback));
				queue.push(go);
				waiting.set(name, queue);
				options.signal?.addEventListener('abort', () => {
					queue.splice(queue.indexOf(go), 1);
					reject(new DOMException('Request aborted', 'AbortError'));
				});
			});
		}
	};
}

/** BroadcastChannel semantics: messages reach every other channel on the bus, asynchronously. */
function fakeBus(): () => ChannelLike {
	const members: ((data: unknown) => void)[] = [];
	return () => {
		const listeners: ((event: MessageEvent) => void)[] = [];
		const deliver = (data: unknown) => {
			for (const l of listeners) l({ data } as MessageEvent);
		};
		members.push(deliver);
		return {
			postMessage(data) {
				for (const member of members) if (member !== deliver) queueMicrotask(() => member(data));
			},
			addEventListener(_type, listener) {
				listeners.push(listener);
			},
			removeEventListener(_type, listener) {
				const idx = listeners.indexOf(listener);
				if (idx !== -1) listeners.splice(idx, 1);
			},
			close() {
				const idx = members.indexOf(deliver);
				if (idx !== -1) members.splice(idx, 1);
				listeners.length = 0;
			}
		};
	};
}

describe('createTabLock', () => {
	it('lets only one tab own the database', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		expect(await first.tryAcquire()).toBe(true);
		expect(await second.tryAcquire()).toBe(false);
	});

	it('hands over after the owner has shut down', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		const events: string[] = [];
		first.onLost(async () => {
			events.push('first shut down');
		});
		await first.tryAcquire();
		await second.takeOver();
		events.push('second owns it');
		expect(events).toEqual(['first shut down', 'second owns it']);
		expect(await first.tryAcquire()).toBe(false);
	});

	it('can take the lock back', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		let firstLost = 0;
		let secondLost = 0;
		first.onLost(async () => void firstLost++);
		second.onLost(async () => void secondLost++);
		await first.tryAcquire();
		await second.takeOver();
		await first.takeOver();
		expect([firstLost, secondLost]).toEqual([1, 1]);
		expect(await second.tryAcquire()).toBe(false);
	});

	it('releases the lock even if shutting down fails', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		first.onLost(() => Promise.reject(new Error('close failed')));
		await first.tryAcquire();
		await expect(second.takeOver()).resolves.toBe(true);
	});

	it('releases the lock even if shutting down never finishes', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel(), shutdownTimeout: 10 });
		const second = createTabLock({ locks, channel: channel() });
		first.onLost(() => new Promise(() => {}));
		await first.tryAcquire();
		await expect(second.takeOver()).resolves.toBe(true);
	});

	it('gives up a takeover the owner never answers', async () => {
		const locks = fakeLocks();
		// Separate buses: the owner is frozen and never hears the request.
		const first = createTabLock({ locks, channel: fakeBus()() });
		const second = createTabLock({ locks, channel: fakeBus()(), takeOverTimeout: 20 });
		await first.tryAcquire();
		expect(await second.takeOver()).toBe(false);
		expect(await second.tryAcquire()).toBe(false);
	});

	it('can force a takeover, and tells the old owner it lost the database', async () => {
		const locks = fakeLocks();
		const first = createTabLock({ locks, channel: fakeBus()() });
		const second = createTabLock({ locks, channel: fakeBus()() });
		let lost = 0;
		first.onLost(async () => void lost++);
		await first.tryAcquire();
		await second.forceTakeOver();
		await new Promise((r) => setTimeout(r, 0));
		expect(lost).toBe(1);
		expect(await first.tryAcquire()).toBe(false);
	});

	it('releases the lock so another lock can acquire it', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const first = createTabLock({ locks, channel: channel() });
		const second = createTabLock({ locks, channel: channel() });
		expect(await first.tryAcquire()).toBe(true);
		expect(await second.tryAcquire()).toBe(false);

		await first.release();
		expect(await second.tryAcquire()).toBe(true);
	});

	it('safely releases when the lock was never acquired', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const lock = createTabLock({ locks, channel: channel() });
		await expect(lock.release()).resolves.toBeUndefined();
	});

	it('stops responding to takeover messages after release', async () => {
		const locks = fakeLocks();
		const channel = fakeBus();
		const firstChannel = channel();
		const first = createTabLock({ locks, channel: firstChannel });
		let lostCalled = false;
		first.onLost(async () => {
			lostCalled = true;
		});
		await first.tryAcquire();
		await first.release();

		const secondChannel = channel();
		secondChannel.postMessage({ type: 'moneta:takeover' });
		await new Promise((r) => setTimeout(r, 10));
		expect(lostCalled).toBe(false);
	});
});
