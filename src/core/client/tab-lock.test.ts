import { describe, it, expect } from 'vitest';
import { createTabLock, type ChannelLike, type LockManagerLike } from './tab-lock';

/** An in-memory Web Locks manager: one holder per name, FIFO waiters. */
function fakeLocks(): LockManagerLike {
	const held = new Set<string>();
	const waiting = new Map<string, (() => void)[]>();
	const grant = (name: string, callback: (lock: unknown) => Promise<void> | void) => {
		held.add(name);
		return Promise.resolve(callback({ name })).finally(() => {
			held.delete(name);
			waiting.get(name)?.shift()?.();
		});
	};
	return {
		request(name, options, callback) {
			if (!held.has(name)) return grant(name, callback);
			if (options.ifAvailable) return Promise.resolve(callback(null));
			return new Promise((resolve) => {
				const queue = waiting.get(name) ?? [];
				queue.push(() => resolve(grant(name, callback)));
				waiting.set(name, queue);
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
		await expect(second.takeOver()).resolves.toBeUndefined();
	});
});
