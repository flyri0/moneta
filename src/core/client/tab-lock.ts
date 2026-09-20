/**
 * Single-tab ownership of the database (the OPFS SAH-pool allows one connection).
 * The owner holds a Web Lock for as long as it runs. Another tab can ask to take over:
 * it queues for the lock and broadcasts a request, the owner shuts its database down and
 * releases the lock, and the queued tab gets it.
 */

/** The part of `navigator.locks` this module uses. */
export interface LockManagerLike {
	request(
		name: string,
		options: { ifAvailable?: boolean },
		callback: (lock: unknown) => Promise<void> | void
	): Promise<unknown>;
}

/** The part of BroadcastChannel this module uses. */
export interface ChannelLike {
	postMessage(message: unknown): void;
	addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface TabLock {
	/** Takes the lock if no other tab holds it. */
	tryAcquire(): Promise<boolean>;
	/** Asks the owner to hand over and resolves once this tab holds the lock. */
	takeOver(): Promise<void>;
	/** Runs when another tab takes over. The lock is released after `handler` settles. */
	onLost(handler: () => Promise<void>): void;
}

export const TAB_LOCK_NAME = 'moneta-db';
const TAKEOVER = 'moneta:takeover';

export function createTabLock(deps: {
	locks: LockManagerLike;
	channel: ChannelLike;
	name?: string;
}): TabLock {
	const name = deps.name ?? TAB_LOCK_NAME;
	let release: (() => void) | null = null;
	let lostHandler: () => Promise<void> = async () => {};

	/** Holds the lock until `release` is called. */
	const hold = () =>
		new Promise<void>((resolve) => {
			release = resolve;
		});

	deps.channel.addEventListener('message', (event) => {
		if ((event.data as { type?: unknown } | null)?.type !== TAKEOVER || !release) return;
		const letGo = release;
		release = null;
		// Release the lock even if shutting down fails, or the other tab would wait forever.
		void lostHandler().then(letGo, letGo);
	});

	return {
		tryAcquire() {
			return new Promise<boolean>((resolve) => {
				void deps.locks.request(name, { ifAvailable: true }, (lock) => {
					resolve(lock !== null);
					return lock !== null ? hold() : undefined;
				});
			});
		},
		takeOver() {
			return new Promise<void>((resolve) => {
				void deps.locks.request(name, {}, () => {
					resolve();
					return hold();
				});
				deps.channel.postMessage({ type: TAKEOVER });
			});
		},
		onLost(handler) {
			lostHandler = handler;
		}
	};
}
