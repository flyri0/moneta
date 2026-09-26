/**
 * The one piece of server code Moneta has, and it is optional: it adds an OAuth client secret to
 * token requests the app makes for cloud backups. Google requires the secret even with PKCE, and it
 * must not ship in the app. It stores nothing: the refresh token stays on the device, and backups
 * go from the browser straight to the provider.
 */

/** A provider's token endpoint and the client credentials the proxy adds. */
export interface TokenProvider {
	tokenUrl: string;
	clientId: string;
	clientSecret: string;
}

export type TokenProviders = Record<string, TokenProvider>;

/** Where the app's OAuth popup lands; the proxy builds it from the caller's origin. */
export const CALLBACK_PATH = '/oauth/callback';

/** The providers whose credentials are set: the client id is shared with the app's build. */
export function providersFromEnv(env: Record<string, string | undefined>): TokenProviders {
	const providers: TokenProviders = {};
	if (env.VITE_GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
		providers.google = {
			tokenUrl: 'https://oauth2.googleapis.com/token',
			clientId: env.VITE_GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET
		};
	return providers;
}

type Grant =
	| { grant: 'authorization_code'; code: string; codeVerifier: string }
	| { grant: 'refresh_token'; refreshToken: string };

function parseGrant(body: unknown): Grant | null {
	if (typeof body !== 'object' || body === null) return null;
	const b = body as Record<string, unknown>;
	if (
		b.grant === 'authorization_code' &&
		typeof b.code === 'string' &&
		typeof b.codeVerifier === 'string'
	)
		return { grant: b.grant, code: b.code, codeVerifier: b.codeVerifier };
	if (b.grant === 'refresh_token' && typeof b.refreshToken === 'string')
		return { grant: b.grant, refreshToken: b.refreshToken };
	return null;
}

function reply(status: number, body: unknown): Response {
	return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/**
 * Exchanges a code or refreshes a token for the app on the same origin. Only the two grants the app
 * uses are accepted, and the callback is always this origin's, so the secret can't serve anything
 * else. The provider's answer, errors included, is passed through as it came.
 */
export async function handleTokenRequest(
	req: Request,
	providerId: string,
	providers: TokenProviders,
	fetcher: typeof fetch = fetch
): Promise<Response> {
	if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
	const origin = new URL(req.url).origin;
	if (req.headers.get('origin') !== origin) return reply(403, { error: 'forbidden_origin' });
	const provider = Object.hasOwn(providers, providerId) ? providers[providerId] : undefined;
	if (!provider) return reply(404, { error: 'unknown_provider' });
	let grant: Grant | null;
	try {
		grant = parseGrant(await req.json());
	} catch {
		grant = null;
	}
	if (!grant) return reply(400, { error: 'invalid_request' });

	const form = new URLSearchParams(
		grant.grant === 'authorization_code'
			? {
					grant_type: grant.grant,
					code: grant.code,
					code_verifier: grant.codeVerifier,
					redirect_uri: origin + CALLBACK_PATH
				}
			: { grant_type: grant.grant, refresh_token: grant.refreshToken }
	);
	form.set('client_id', provider.clientId);
	form.set('client_secret', provider.clientSecret);

	let res: Response;
	try {
		res = await fetcher(provider.tokenUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: form.toString()
		});
	} catch {
		return reply(502, { error: 'provider_unreachable' });
	}
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return reply(502, { error: 'provider_bad_response' });
	}
	return reply(res.status, body);
}
