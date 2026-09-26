import { describe, it, expect, vi } from 'vitest';
import { DomainError } from '$domain/errors';
import { accessTokens, memoryAuthStore, type StoredAuth } from './tokens';
import type { TokenGrant, TokenRequest } from './oauth';

const HOUR = 60 * 60 * 1000;

const SAVED: StoredAuth = {
	refreshToken: 'refresh',
	accessToken: 'old-access',
	expiresAt: HOUR,
	account: 'me@example.com'
};

function setup(auth: StoredAuth | null = SAVED) {
	const store = memoryAuthStore();
	if (auth) void store.set('google', auth);
	let clock = 0;
	let refreshes = 0;
	const request = vi.fn<(provider: string, req: TokenRequest) => Promise<TokenGrant>>(async () => ({
		accessToken: `new-access-${++refreshes}`,
		expiresAt: clock + HOUR
	}));
	const tokens = accessTokens('google', store, { request, now: () => clock });
	return { store, request, tokens, tick: (ms: number) => (clock += ms) };
}

describe('accessTokens', () => {
	it('uses the saved access token while it has more than five minutes left', async () => {
		const { tokens, request, tick } = setup();
		tick(HOUR - 6 * 60_000);
		expect(await tokens.get()).toBe('old-access');
		expect(request).not.toHaveBeenCalled();
	});

	it('refreshes near expiry and saves the new token with the old refresh token', async () => {
		const { tokens, request, store, tick } = setup();
		tick(HOUR - 4 * 60_000);
		expect(await tokens.get()).toBe('new-access-1');
		expect(request).toHaveBeenCalledWith('google', {
			grant: 'refresh_token',
			refreshToken: 'refresh'
		});
		expect(await store.get('google')).toMatchObject({
			refreshToken: 'refresh',
			accessToken: 'new-access-1',
			account: 'me@example.com'
		});
		expect(await tokens.get()).toBe('new-access-1');
		expect(request).toHaveBeenCalledOnce();
	});

	it('refreshes once for callers that ask at the same time, and on demand', async () => {
		const { tokens, request, tick } = setup();
		tick(HOUR);
		const [a, b] = await Promise.all([tokens.get(), tokens.get()]);
		expect(a).toBe(b);
		expect(request).toHaveBeenCalledOnce();
		expect(await tokens.renew()).toBe('new-access-2');
	});

	it('needs a new sign-in when nothing is saved', async () => {
		const { tokens } = setup(null);
		await expect(tokens.get()).rejects.toMatchObject({ code: 'CLOUD_AUTH_NEEDED' });
	});

	it('passes refresh failures on and tries again next time', async () => {
		const { tokens, request, tick } = setup();
		tick(HOUR);
		request.mockRejectedValueOnce(new DomainError('CLOUD_UNAVAILABLE'));
		await expect(tokens.get()).rejects.toMatchObject({ code: 'CLOUD_UNAVAILABLE' });
		expect(await tokens.get()).toBe('new-access-1');
	});
});

describe('memoryAuthStore', () => {
	it('keeps one record per provider', async () => {
		const store = memoryAuthStore();
		await store.set('google', SAVED);
		expect(await store.get('google')).toEqual(SAVED);
		expect(await store.get('dropbox')).toBeNull();
		await store.delete('google');
		expect(await store.get('google')).toBeNull();
	});
});
