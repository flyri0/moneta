import { describe, it, expect, vi } from 'vitest';
import { handleTokenRequest, providersFromEnv, type TokenProviders } from './token-proxy';

const ORIGIN = 'https://moneta.example';
const PROVIDERS: TokenProviders = {
	google: {
		tokenUrl: 'https://oauth2.googleapis.com/token',
		clientId: 'client-id',
		clientSecret: 'client-secret'
	}
};

function request(
	body: unknown,
	{ origin = ORIGIN, method = 'POST', path = '/api/oauth/google/token' } = {}
): Request {
	return new Request(`${ORIGIN}${path}`, {
		method,
		headers: { 'content-type': 'application/json', origin },
		body: method === 'POST' ? JSON.stringify(body) : undefined
	});
}

function upstream(status = 200, body: unknown = { access_token: 'a', expires_in: 3599 }) {
	return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

async function sentForm(fetcher: ReturnType<typeof upstream>): Promise<URLSearchParams> {
	const init = fetcher.mock.calls[0][1];
	return new URLSearchParams(String(init?.body));
}

describe('handleTokenRequest', () => {
	it('exchanges a code with the client secret and the callback on its own origin', async () => {
		const fetcher = upstream();
		const res = await handleTokenRequest(
			request({ grant: 'authorization_code', code: 'the-code', codeVerifier: 'verifier' }),
			'google',
			PROVIDERS,
			fetcher
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ access_token: 'a', expires_in: 3599 });
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(fetcher.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
		expect(Object.fromEntries(await sentForm(fetcher))).toEqual({
			grant_type: 'authorization_code',
			code: 'the-code',
			code_verifier: 'verifier',
			redirect_uri: `${ORIGIN}/oauth/callback`,
			client_id: 'client-id',
			client_secret: 'client-secret'
		});
	});

	it('refreshes an access token', async () => {
		const fetcher = upstream();
		await handleTokenRequest(
			request({ grant: 'refresh_token', refreshToken: 'refresh' }),
			'google',
			PROVIDERS,
			fetcher
		);
		expect(Object.fromEntries(await sentForm(fetcher))).toEqual({
			grant_type: 'refresh_token',
			refresh_token: 'refresh',
			client_id: 'client-id',
			client_secret: 'client-secret'
		});
	});

	it("passes the provider's errors through as they came", async () => {
		const fetcher = upstream(400, { error: 'invalid_grant' });
		const res = await handleTokenRequest(
			request({ grant: 'refresh_token', refreshToken: 'revoked' }),
			'google',
			PROVIDERS,
			fetcher
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'invalid_grant' });
	});

	it('refuses calls from another origin, or with none', async () => {
		const fetcher = upstream();
		const body = { grant: 'refresh_token', refreshToken: 'r' };
		const other = await handleTokenRequest(
			request(body, { origin: 'https://evil.example' }),
			'google',
			PROVIDERS,
			fetcher
		);
		expect(other.status).toBe(403);
		const none = new Request(`${ORIGIN}/api/oauth/google/token`, {
			method: 'POST',
			body: JSON.stringify(body)
		});
		expect((await handleTokenRequest(none, 'google', PROVIDERS, fetcher)).status).toBe(403);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('refuses other methods, unknown providers and malformed bodies', async () => {
		const fetcher = upstream();
		const ok = { grant: 'refresh_token', refreshToken: 'r' };
		expect(
			(await handleTokenRequest(request(ok, { method: 'GET' }), 'google', PROVIDERS, fetcher))
				.status
		).toBe(405);
		expect((await handleTokenRequest(request(ok), 'dropbox', PROVIDERS, fetcher)).status).toBe(404);
		for (const body of [
			{ grant: 'client_credentials' },
			{ grant: 'refresh_token' },
			{ grant: 'authorization_code', code: 'c' },
			{ grant: 'authorization_code', code: 1, codeVerifier: 'v' },
			'not an object'
		])
			expect((await handleTokenRequest(request(body), 'google', PROVIDERS, fetcher)).status).toBe(
				400
			);
		const broken = new Request(`${ORIGIN}/api/oauth/google/token`, {
			method: 'POST',
			headers: { origin: ORIGIN },
			body: '{'
		});
		expect((await handleTokenRequest(broken, 'google', PROVIDERS, fetcher)).status).toBe(400);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('answers 502 when the provider cannot be reached', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => {
			throw new TypeError('fetch failed');
		});
		const res = await handleTokenRequest(
			request({ grant: 'refresh_token', refreshToken: 'r' }),
			'google',
			PROVIDERS,
			fetcher
		);
		expect(res.status).toBe(502);
	});
});

describe('providersFromEnv', () => {
	it('lists only the providers whose client id and secret are both set', () => {
		expect(providersFromEnv({})).toEqual({});
		expect(providersFromEnv({ VITE_GOOGLE_CLIENT_ID: 'id' })).toEqual({});
		expect(
			providersFromEnv({ VITE_GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })
		).toEqual({
			google: {
				tokenUrl: 'https://oauth2.googleapis.com/token',
				clientId: 'id',
				clientSecret: 'secret'
			}
		});
	});
});
