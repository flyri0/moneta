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
		await expect(second.takeOver()).resolves.toBeUndefined();
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
