/**
 * Whether the browser may clear this site's data to free up space, and what the user can do:
 * `ask` (the browser shows a prompt), `blocked` (the user declined it), `automatic` (the browser
 * decides by itself, from installs, bookmarks and use).
 */
export type Persistence = 'unsupported' | 'persisted' | 'ask' | 'blocked' | 'automatic';

type StorageLike = Partial<Pick<StorageManager, 'persisted' | 'persist'>>;
type PermissionsLike = Pick<Permissions, 'query'>;

/** Firefox asks the user; Chromium and Safari decide by themselves, without a prompt. */
export function browserAsks(ua: string): boolean {
	// Firefox for iOS says FxiOS and is WebKit underneath.
	return /Firefox\//.test(ua);
}

/**
 * The state to show. `persisted()` is the truth: Firefox keeps the data persistent when the
 * permission is cleared, until the site's data itself is cleared.
 */
export function persistence(
	persisted: boolean | null,
	permission: PermissionState | null,
	asks: boolean
): Persistence {
	if (persisted === null) return 'unsupported';
	if (persisted) return 'persisted';
	if (permission === 'denied') return 'blocked';
	return asks ? 'ask' : 'automatic';
}

/** The persistent-storage permission, or null where it is unknown (Safari). Its `state` is live. */
export async function permissionStatus(
	permissions: PermissionsLike | undefined
): Promise<PermissionStatus | null> {
	try {
		return (await permissions?.query({ name: 'persistent-storage' })) ?? null;
	} catch {
		return null;
	}
}

/** Reads the current state, tolerating browsers without the Storage API. */
export async function readPersistence(
	storage: StorageLike | undefined,
	permission: Pick<PermissionStatus, 'state'> | null,
	ua: string
): Promise<Persistence> {
	let persisted: boolean | null = null;
	try {
		persisted = (await storage?.persisted?.()) ?? null;
	} catch {
		// Reported as unsupported.
	}
	return persistence(persisted, permission?.state ?? null, browserAsks(ua));
}

/**
 * Asks for persistence where that shows no prompt, so an installed or often used app gets it
 * without a click. Never in Firefox, where it would prompt out of the blue.
 */
export async function persistQuietly(storage: StorageLike | undefined, ua: string): Promise<void> {
	if (browserAsks(ua)) return;
	try {
		await storage?.persist?.();
	} catch {
		// Nothing to do: the settings show the state.
	}
}
