import { DomainError } from '$domain/errors';

/**
 * OAuth 2.0 with PKCE for cloud backups, shared by every provider. The sign-in runs in a popup
 * that lands on `/oauth/callback`, which hands the code back over a BroadcastChannel: the
 * provider's pages cut the popup off from its opener. Codes are exchanged and tokens refreshed
 * through the token proxy (`netlify/lib/token-proxy.ts`), which adds the client secret.
 */

/** A provider's sign-in page and the client asking. */
export interface OAuthClient {
	/** The provider's name in the token proxy's path. */
	provider: string;
	authorizeUrl: string;
	clientId: string;
	scope: string;
	/** Anything else the provider wants on the sign-in URL. */
	params?: Record<string, string>;
}

/** What the callback page sends back: the code, or the error the provider reported. */
export interface CallbackMessage {
	state: string;
	code?: string;
	error?: string;
}

/** Where the sign-in lands, on the app's own origin. */
export const CALLBACK_PATH = '/oauth/callback';
/** The channel the callback page answers on. */
export const OAUTH_CHANNEL = 'moneta-oauth';

function base64url(bytes: ArrayBuffer | Uint8Array): string {
	let text = '';
	for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
	return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random URL-safe string, for the state and the verifier. */
function randomToken(bytes = 32): string {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** A PKCE verifier and its S256 challenge. */
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
	const verifier = randomToken();
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: base64url(digest) };
}

export function authorizeUrl(
	client: OAuthClient,
	request: { redirectUri: string; state: string; challenge: string }
): string {
	const url = new URL(client.authorizeUrl);
	const params = {
		client_id: client.clientId,
		redirect_uri: request.redirectUri,
		response_type: 'code',
		scope: client.scope,
		state: request.state,
		code_challenge: request.challenge,
		code_challenge_method: 'S256',
		...client.params
	};
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url.toString();
}

/** The callback page's answer, read from its query string; null when it has no state. */
export function callbackMessage(search: string): CallbackMessage | null {
	const params = new URLSearchParams(search);
	const state = params.get('state');
	if (!state) return null;
	const code = params.get('code');
	const error = params.get('error');
	if (code) return { state, code };
	if (error) return { state, error };
	return null;
}

/** The popup, as far as the sign-in needs it. */
interface Popup {
	location: { href: string };
	close(): void;
}

/** What the sign-in needs from the browser; `browserSignIn` gives the real ones. */
export interface SignInDeps {
	/** Opens an empty popup. Called before anything is awaited, while the click still counts. */
	open(): Popup | null;
	/** Listens for the callback page. Returns the function that stops listening. */
	listen(onMessage: (message: CallbackMessage) => void): () => void;
	redirectUri: string;
	timeoutMs: number;
}

/** The popup and channel in a browser, with five minutes to sign in. */
export function browserSignIn(): SignInDeps {
	return {
		open: () => window.open('', 'moneta-oauth', 'popup,width=480,height=640'),
		listen(onMessage) {
			const channel = new BroadcastChannel(OAUTH_CHANNEL);
			channel.onmessage = (event: MessageEvent) => onMessage(event.data as CallbackMessage);
			return () => channel.close();
		},
		redirectUri: location.origin + CALLBACK_PATH,
		timeoutMs: 5 * 60_000
	};
}

/**
 * Signs in with the provider in a popup, and returns the code with its PKCE verifier. Call it
 * straight from a click: the popup opens before anything is awaited. Returns null when the user
 * says no, closes the sign-in without answering (after the timeout) or cancels through `signal`.
 */
export async function signIn(
	client: OAuthClient,
	deps: SignInDeps = browserSignIn(),
	signal?: AbortSignal
): Promise<{ code: string; verifier: string } | null> {
	const popup = deps.open();
	if (!popup) throw new DomainError('CLOUD_POPUP_BLOCKED');
	const state = randomToken(16);
	let stop = () => {};
	const reply = new Promise<CallbackMessage | null>((resolve) => {
		const timer = setTimeout(() => resolve(null), deps.timeoutMs);
		const onAbort = () => resolve(null);
		signal?.addEventListener('abort', onAbort);
		const unlisten = deps.listen((message) => {
			if (message?.state === state) resolve(message);
		});
		stop = () => {
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			unlisten();
		};
		if (signal?.aborted) resolve(null);
	});
	try {
		const { verifier, challenge } = await pkcePair();
		popup.location.href = authorizeUrl(client, {
			redirectUri: deps.redirectUri,
			state,
			challenge
		});
		const message = await reply;
		if (!message || message.error === 'access_denied') {
			popup.close();
			return null;
		}
		if (!message.code)
			throw new DomainError('CLOUD_FAILED', `Sign-in failed: ${message.error}`, message);
		return { code: message.code, verifier };
	} finally {
		stop();
	}
}

/** A grant the token proxy accepts. */
export type TokenRequest =
	| { grant: 'authorization_code'; code: string; codeVerifier: string }
	| { grant: 'refresh_token'; refreshToken: string };

/** The tokens a grant gave: a refresh token only comes with a code. */
export interface TokenGrant {
	accessToken: string;
	/** When the access token expires, in epoch milliseconds. */
	expiresAt: number;
	refreshToken?: string;
	/** The scopes granted, space-separated: the user may have unticked some. */
	scope?: string;
}

/**
 * Asks the token proxy for tokens. A refused grant (revoked, or expired after months unused) is
 * CLOUD_AUTH_NEEDED; a network failure or an unreachable provider is CLOUD_UNAVAILABLE.
 */
export async function requestToken(
	provider: string,
	request: TokenRequest,
	fetcher: typeof fetch = fetch,
	now = Date.now()
): Promise<TokenGrant> {
	let res: Response;
	try {
		res = await fetcher(`/api/oauth/${provider}/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(request)
		});
	} catch (err) {
		throw new DomainError('CLOUD_UNAVAILABLE', String(err));
	}
	let body: Record<string, unknown>;
	try {
		body = (await res.json()) as Record<string, unknown>;
	} catch {
		throw new DomainError('CLOUD_FAILED', `The token service answered ${res.status}, not JSON`);
	}
	if (!res.ok) {
		if (body.error === 'invalid_grant') throw new DomainError('CLOUD_AUTH_NEEDED');
		if (res.status >= 500 || res.status === 429)
			throw new DomainError('CLOUD_UNAVAILABLE', `The token service answered ${res.status}`);
		throw new DomainError('CLOUD_FAILED', `The token service answered ${res.status}`, body);
	}
	if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number')
		throw new DomainError('CLOUD_FAILED', 'The token service gave no access token');
	return {
		accessToken: body.access_token,
		expiresAt: now + body.expires_in * 1000,
		...(typeof body.refresh_token === 'string' ? { refreshToken: body.refresh_token } : {}),
		...(typeof body.scope === 'string' ? { scope: body.scope } : {})
	};
}
