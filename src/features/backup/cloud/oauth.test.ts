import { describe, it, expect, vi } from 'vitest';
import {
	authorizeUrl,
	callbackMessage,
	pkcePair,
	requestToken,
	signIn,
	type CallbackMessage,
	type OAuthClient,
	type SignInDeps
} from './oauth';

const CLIENT: OAuthClient = {
	provider: 'google',
	authorizeUrl: 'https://accounts.example/auth',
	clientId: 'client-id',
	scope: 'drive.file',
	params: { access_type: 'offline' }
};

function base64url(bytes: ArrayBuffer): string {
	return Buffer.from(bytes).toString('base64url');
}

describe('pkcePair', () => {
	it('makes a random verifier and its S256 challenge', async () => {
		const a = await pkcePair();
		const b = await pkcePair();
		expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
		expect(a.verifier).not.toBe(b.verifier);
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.verifier));
		expect(a.challenge).toBe(base64url(digest));
	});
});

describe('authorizeUrl', () => {
	it('asks for a code with PKCE, the state and the extra parameters', () => {
		const url = new URL(
			authorizeUrl(CLIENT, {
				redirectUri: 'https://moneta.example/oauth/callback',
				state: 'st',
				challenge: 'ch'
			})
		);
		expect(url.origin + url.pathname).toBe('https://accounts.example/auth');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			client_id: 'client-id',
			redirect_uri: 'https://moneta.example/oauth/callback',
			response_type: 'code',
			scope: 'drive.file',
			state: 'st',
			code_challenge: 'ch',
			code_challenge_method: 'S256',
			access_type: 'offline'
		});
	});
});

describe('callbackMessage', () => {
	it('reads the code or the error the provider sent back', () => {
		expect(callbackMessage('?code=c&state=s&scope=x')).toEqual({ state: 's', code: 'c' });
		expect(callbackMessage('?error=access_denied&state=s')).toEqual({
			state: 's',
			error: 'access_denied'
		});
		expect(callbackMessage('?code=c')).toBeNull();
		expect(callbackMessage('')).toBeNull();
	});
});

/** A popup and a channel the test drives by hand. */
function fakeDeps(popupOpens = true) {
	const popup = { location: { href: '' }, close: vi.fn() };
	let listener: ((message: CallbackMessage) => void) | null = null;
	const deps: SignInDeps = {
		open: vi.fn(() => (popupOpens ? popup : null)),
		listen(onMessage) {
			listener = onMessage;
			return () => (listener = null);
		},
		redirectUri: 'https://moneta.example/oauth/callback',
		timeoutMs: 1000
	};
	return {
		deps,
		popup,
		/** Answers like the callback page, once the popup has been sent to the provider. */
		async answer(reply: Omit<CallbackMessage, 'state'>, state?: string) {
			await vi.waitFor(() => expect(popup.location.href).not.toBe(''));
			const sent = new URL(popup.location.href).searchParams.get('state') ?? '';
			listener?.({ state: state ?? sent, ...reply });
		},
		listening: () => listener !== null
	};
}

describe('signIn', () => {
	it('opens the popup at once, then returns the code and the verifier', async () => {
		const fake = fakeDeps();
		const result = signIn(CLIENT, fake.deps);
		// Opened before anything is awaited, while the click still counts.
		expect(fake.deps.open).toHaveBeenCalledOnce();
		await fake.answer({ code: 'the-code' });
		const { code, verifier } = (await result)!;
		expect(code).toBe('the-code');
		const url = new URL(fake.popup.location.href);
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
		expect(url.searchParams.get('code_challenge')).toBe(base64url(digest));
		expect(fake.listening()).toBe(false);
	});

	it('ignores answers to another sign-in', async () => {
		const fake = fakeDeps();
		const result = signIn(CLIENT, fake.deps);
		await fake.answer({ code: 'stale' }, 'another-state');
		await fake.answer({ code: 'right' });
		expect((await result)?.code).toBe('right');
	});

	it('returns null when the user says no, gives up or cancels', async () => {
		const denied = fakeDeps();
		const result = signIn(CLIENT, denied.deps);
		await denied.answer({ error: 'access_denied' });
		expect(await result).toBeNull();

		vi.useFakeTimers();
		try {
			const late = fakeDeps();
			const timedOut = signIn(CLIENT, late.deps);
			await vi.advanceTimersByTimeAsync(1000);
			expect(await timedOut).toBeNull();
			expect(late.popup.close).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}

		const cancel = new AbortController();
		const fake = fakeDeps();
		const cancelled = signIn(CLIENT, fake.deps, cancel.signal);
		cancel.abort();
		expect(await cancelled).toBeNull();
		expect(fake.listening()).toBe(false);
	});

	it('fails when the popup is blocked or the provider reports an error', async () => {
		await expect(signIn(CLIENT, fakeDeps(false).deps)).rejects.toMatchObject({
			code: 'CLOUD_POPUP_BLOCKED'
		});
		const fake = fakeDeps();
		const result = signIn(CLIENT, fake.deps);
		await fake.answer({ error: 'invalid_scope' });
		await expect(result).rejects.toMatchObject({ code: 'CLOUD_FAILED' });
	});
});

function answering(status: number, body: unknown) {
	return vi.fn<typeof fetch>(async () =>
		typeof body === 'string'
			? new Response(body, { status, headers: { 'content-type': 'text/html' } })
			: Response.json(body, { status })
	);
}

describe('requestToken', () => {
	it('posts the grant to the token proxy and reads the tokens', async () => {
		const fetcher = answering(200, {
			access_token: 'access',
			expires_in: 3599,
			refresh_token: 'refresh',
			scope: 'a b'
		});
		const grant = await requestToken(
			'google',
			{ grant: 'authorization_code', code: 'c', codeVerifier: 'v' },
			fetcher,
			1000
		);
		expect(grant).toEqual({
			accessToken: 'access',
			expiresAt: 1000 + 3599 * 1000,
			refreshToken: 'refresh',
			scope: 'a b'
		});
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('/api/oauth/google/token');
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toEqual({
			grant: 'authorization_code',
			code: 'c',
			codeVerifier: 'v'
		});
	});

	it('tells a revoked grant, an outage and a broken answer apart', async () => {
		const refresh = { grant: 'refresh_token' as const, refreshToken: 'r' };
		await expect(
			requestToken('google', refresh, answering(400, { error: 'invalid_grant' }))
		).rejects.toMatchObject({ code: 'CLOUD_AUTH_NEEDED' });
		await expect(
			requestToken('google', refresh, answering(502, { error: 'provider_unreachable' }))
		).rejects.toMatchObject({ code: 'CLOUD_UNAVAILABLE' });
		await expect(
			requestToken(
				'google',
				refresh,
				vi.fn<typeof fetch>(async () => {
					throw new TypeError('Failed to fetch');
				})
			)
		).rejects.toMatchObject({ code: 'CLOUD_UNAVAILABLE' });
		// A host without the function answers with the app's page.
		await expect(
			requestToken('google', refresh, answering(200, '<!doctype html>'))
		).rejects.toMatchObject({ code: 'CLOUD_FAILED' });
		await expect(
			requestToken('google', refresh, answering(400, { error: 'invalid_client' }))
		).rejects.toMatchObject({ code: 'CLOUD_FAILED' });
		await expect(
			requestToken('google', refresh, answering(200, { token_type: 'Bearer' }))
		).rejects.toMatchObject({ code: 'CLOUD_FAILED' });
	});
});
