/**
 * Single-tab ownership of the database (the OPFS SAH-pool allows one connection).
 * The owner holds a Web Lock for as long as it runs. Another tab can ask to take over:
 * it queues for the lock and broadcasts a request, the owner shuts its database down and
 * releases the lock, and the queued tab gets it.
 */

import { settleWithin } from './timeout';

/** The part of `navigator.locks` this module uses. */
export interface LockManagerLike {
	request(
		name: string,
		options: { ifAvailable?: boolean; steal?: boolean; signal?: AbortSignal },
		callback: (lock: unknown) => Promise<void> | void
	): Promise<unknown>;
}

/** The part of BroadcastChannel this module uses. */
export interface ChannelLike {
	postMessage(message: unknown): void;
	addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
	removeEventListener?(type: 'message', listener: (event: MessageEvent) => void): void;
	close?(): void;
}

export interface TabLock {
	/** Takes the lock if no other tab holds it. */
	tryAcquire(): Promise<boolean>;
	/**
	 * Asks the owner to hand over. Resolves true once this tab holds the lock, or false when the
	 * owner didn't hand over in time (a frozen or stuck tab).
	 */
	takeOver(): Promise<boolean>;
	/**
	 * Takes the lock whether or not the owner hands over (Web Locks `steal`). The owner is told it
	 * lost the lock, but a stuck tab can't close its database first.
	 */
	forceTakeOver(): Promise<void>;
	/**
	 * Runs when another tab takes over. The lock is released after `handler` settles, or after
	 * a few seconds if it doesn't.
	 */
	onLost(handler: () => Promise<void>): void;
	/** Releases the lock if held and tears down channel listeners. */
	release(): Promise<void>;
}

export const TAB_LOCK_NAME = 'moneta-db';
/** How long a takeover waits for this tab to shut down before the lock is let go anyway. */
const SHUTDOWN_TIMEOUT = 5000;
/** How long a takeover waits for the owner to hand over before giving up. */
const TAKEOVER_TIMEOUT = 10_000;
const TAKEOVER = 'moneta:takeover';

export function createTabLock(deps: {
	locks: LockManagerLike;
	channel: ChannelLike;
	name?: string;
	shutdownTimeout?: number;
	takeOverTimeout?: number;
}): TabLock {
	const name = deps.name ?? TAB_LOCK_NAME;
	const shutdownTimeout = deps.shutdownTimeout ?? SHUTDOWN_TIMEOUT;
	const takeOverTimeout = deps.takeOverTimeout ?? TAKEOVER_TIMEOUT;
	let releaseHold: (() => void) | null = null;
	let lostHandler: () => Promise<void> = async () => {};
	let lockPromise: Promise<unknown> | null = null;

	/** Holds the lock until `releaseHold` is called. */
	const hold = () =>
		new Promise<void>((resolve) => {
			releaseHold = resolve;
		});

	const onMessage = (event: MessageEvent) => {
		if ((event.data as { type?: unknown } | null)?.type !== TAKEOVER || !releaseHold) return;
		const letGo = releaseHold;
		releaseHold = null;
		// Release the lock even if shutting down fails or hangs, or the other tab would wait forever.
		void settleWithin(lostHandler(), shutdownTimeout).then(letGo);
	};

	deps.channel.addEventListener('message', onMessage);

	/** A lock held by `request` rejects when another tab steals it: this tab has lost it. */
	const watch = (request: Promise<unknown>) => {
		request.catch(() => {
			if (!releaseHold) return;
			releaseHold = null;
			void lostHandler().catch(() => {});
		});
	};

	return {
		tryAcquire() {
			return new Promise<boolean>((resolve) => {
				lockPromise = deps.locks.request(name, { ifAvailable: true }, (lock) => {
					resolve(lock !== null);
					return lock !== null ? hold() : undefined;
				});
				watch(lockPromise);
			});
		},
		takeOver() {
			return new Promise<boolean>((resolve) => {
				const giveUp = new AbortController();
				const timer = setTimeout(() => giveUp.abort(), takeOverTimeout);
				lockPromise = deps.locks.request(name, { signal: giveUp.signal }, () => {
					clearTimeout(timer);
					resolve(true);
					return hold();
				});
				// Aborted while waiting: the request rejects and the lock was never held.
				lockPromise.catch(() => resolve(false));
				watch(lockPromise);
				deps.channel.postMessage({ type: TAKEOVER });
			});
		},
		forceTakeOver() {
			return new Promise<void>((resolve) => {
				lockPromise = deps.locks.request(name, { steal: true }, () => {
					resolve();
					return hold();
				});
				watch(lockPromise);
			});
		},
		onLost(handler) {
			lostHandler = handler;
		},
		async release() {
			deps.channel.removeEventListener?.('message', onMessage);
			deps.channel.close?.();
			if (releaseHold) {
				const letGo = releaseHold;
				releaseHold = null;
				letGo();
				await lockPromise?.catch(() => {});
			}
		}
	};
}
