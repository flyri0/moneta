import { DomainError } from '$domain/errors';
import { requestToken, type TokenGrant, type TokenRequest } from './oauth';

/** A cloud connection saved on this device: the tokens, and whose storage it is. */
export interface StoredAuth {
	refreshToken: string;
	accessToken: string;
	/** When the access token expires, in epoch milliseconds. */
	expiresAt: number;
	/** The account's email or name, to show which storage backups go to. */
	account: string;
}

/** Where connections are saved, one per provider. */
export interface AuthStore {
	get(provider: string): Promise<StoredAuth | null>;
	set(provider: string, auth: StoredAuth): Promise<void>;
	delete(provider: string): Promise<void>;
}

export function memoryAuthStore(): AuthStore {
	const records = new Map<string, StoredAuth>();
	return {
		async get(provider) {
			return records.get(provider) ?? null;
		},
		async set(provider, auth) {
			records.set(provider, auth);
		},
		async delete(provider) {
			records.delete(provider);
		}
	};
}

/** The IndexedDB database holding the connections, apart from the worker's `moneta` one. */
export const AUTH_DB = 'moneta-cloud';

function done<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** Connections in IndexedDB (database `moneta-cloud`, store `auth`). */
export function idbAuthStore(): AuthStore {
	const STORE = 'auth';
	let opened: Promise<IDBDatabase> | null = null;
	function open(): Promise<IDBDatabase> {
		if (!opened) {
			const request = indexedDB.open(AUTH_DB, 1);
			request.onupgradeneeded = () => request.result.createObjectStore(STORE);
			opened = done(request);
			opened.catch(() => (opened = null));
		}
		return opened;
	}
	async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
		return (await open()).transaction(STORE, mode).objectStore(STORE);
	}
	return {
		async get(provider) {
			return ((await done((await store('readonly')).get(provider))) as StoredAuth) ?? null;
		},
		async set(provider, auth) {
			await done((await store('readwrite')).put(auth, provider));
		},
		async delete(provider) {
			await done((await store('readwrite')).delete(provider));
		}
	};
}

/** Deletes every saved connection, for wiping the device. */
export async function deleteAuthDb(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(AUTH_DB);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		// Another tab holds it open; it goes once that tab lets go.
		request.onblocked = () => resolve();
	});
}

/** A token is renewed this long before it expires, so it doesn't lapse during an upload. */
const MARGIN_MS = 5 * 60_000;

export interface AccessTokens {
	/** A valid access token, refreshed when it is about to expire. */
	get(): Promise<string>;
	/** A new access token, for when the provider refused the saved one. */
	renew(): Promise<string>;
}

/**
 * The access tokens of a saved connection. Without one, or once the provider refuses the refresh
 * token, this is CLOUD_AUTH_NEEDED: the user has to sign in again.
 */
export function accessTokens(
	provider: string,
	store: AuthStore,
	deps: {
		request?: (provider: string, request: TokenRequest) => Promise<TokenGrant>;
		now?: () => number;
	} = {}
): AccessTokens {
	const { request = (p, r) => requestToken(p, r), now = Date.now } = deps;
	let renewing: Promise<string> | null = null;

	async function saved(): Promise<StoredAuth> {
		const auth = await store.get(provider);
		if (!auth) throw new DomainError('CLOUD_AUTH_NEEDED');
		return auth;
	}

	function renew(): Promise<string> {
		renewing ??= (async () => {
			const auth = await saved();
			const grant = await request(provider, {
				grant: 'refresh_token',
				refreshToken: auth.refreshToken
			});
			await store.set(provider, {
				...auth,
				accessToken: grant.accessToken,
				expiresAt: grant.expiresAt,
				refreshToken: grant.refreshToken ?? auth.refreshToken
			});
			return grant.accessToken;
		})().finally(() => (renewing = null));
		return renewing;
	}

	return {
		async get() {
			if (renewing) return renewing;
			const auth = await saved();
			return auth.expiresAt - MARGIN_MS > now() ? auth.accessToken : renew();
		},
		renew
	};
}
