import { describe, it, expect, vi } from 'vitest';
import { googleDrive, DRIVE_SCOPE } from './google-drive';
import { answeringPopup, fakeDrive } from './testing';
import { memoryAuthStore } from './tokens';
import type { CallbackMessage } from './oauth';
import type { BackupFileInfo } from './provider';

const INFO: BackupFileInfo = {
	name: 'moneta-backup-2026-09-26.moneta',
	day: '2026-09-26',
	device: 'laptop',
	deviceLabel: 'Firefox on Linux'
};

function setup(reply?: Omit<CallbackMessage, 'state'>) {
	const drive = fakeDrive();
	const store = memoryAuthStore();
	let clock = 0;
	const provider = googleDrive({
		clientId: 'client-id',
		store,
		fetcher: drive.fetcher,
		signInDeps: answeringPopup(reply),
		now: () => clock
	});
	return { drive, store, provider, tick: (ms: number) => (clock += ms) };
}

async function connected() {
	const s = setup();
	const connection = (await s.provider.connect())!;
	return { ...s, connection };
}

function blob(text: string): Blob {
	return new Blob([text]);
}

describe('googleDrive', () => {
	it('is available only with a client id', () => {
		const store = memoryAuthStore();
		expect(googleDrive({ clientId: 'id', store }).available()).toBe(true);
		expect(googleDrive({ clientId: undefined, store }).available()).toBe(false);
		expect(googleDrive({ clientId: '', store }).available()).toBe(false);
	});

	it('connects, saves the tokens and names the account', async () => {
		const { provider, store } = setup();
		const connection = await provider.connect();
		expect(connection?.account).toBe('me@example.com');
		expect(await store.get('google')).toMatchObject({
			refreshToken: 'refresh',
			account: 'me@example.com'
		});
		expect((await provider.resume())?.account).toBe('me@example.com');
	});

	it('returns null when the user says no, and saves nothing', async () => {
		const { provider, store } = setup({ error: 'access_denied' });
		expect(await provider.connect()).toBeNull();
		expect(await store.get('google')).toBeNull();
		expect(await provider.resume()).toBeNull();
	});

	it('refuses a sign-in without the Drive permission', async () => {
		const { provider, drive, store } = setup();
		const answer = drive.fetcher;
		const fetcher = vi.fn<typeof fetch>(async (input, init) => {
			const res = await answer(input, init);
			if (!String(input).startsWith('/api/oauth/')) return res;
			return Response.json({ ...(await res.json()), scope: 'openid' });
		});
		const noScope = googleDrive({
			clientId: 'id',
			store,
			fetcher,
			signInDeps: answeringPopup()
		});
		await expect(noScope.connect()).rejects.toMatchObject({ code: 'CLOUD_PERMISSION_DENIED' });
		expect(await store.get('google')).toBeNull();
		expect(provider.available()).toBe(true);
	});

	it('saves backups in a Moneta folder, one file per device and day', async () => {
		const { connection, drive } = await connected();
		const first = await connection.upload(INFO, blob('one'));
		expect(first).toMatchObject({ ...INFO, size: 3 });
		const [folder] = [...drive.state.files.values()].filter(
			(f) => f.mimeType === 'application/vnd.google-apps.folder'
		);
		expect(folder.name).toBe('Moneta');
		expect(drive.state.files.get(first.id)?.parents).toEqual([folder.id]);

		// The same day again replaces the file; another day or device adds one.
		const again = await connection.upload(INFO, blob('two!'));
		expect(again.id).toBe(first.id);
		expect(await (await connection.download(first.id)).text()).toBe('two!');
		await connection.upload({ ...INFO, day: '2026-09-27' }, blob('3'));
		await connection.upload({ ...INFO, device: 'phone' }, blob('4'));
		expect(drive.backups()).toEqual(['2026-09-26 laptop', '2026-09-27 laptop', '2026-09-26 phone']);
		const folders = [...drive.state.files.values()].filter(
			(f) => f.appProperties.moneta === 'folder'
		);
		expect(folders).toHaveLength(1);
	});

	it('lists backups newest first and deletes them', async () => {
		const { connection } = await connected();
		const a = await connection.upload(INFO, blob('a'));
		const b = await connection.upload({ ...INFO, day: '2026-09-27' }, blob('b'));
		expect((await connection.list()).map((x) => x.id)).toEqual([b.id, a.id]);
		await connection.remove(a.id);
		// Already gone is fine.
		await connection.remove(a.id);
		expect((await connection.list()).map((x) => x.id)).toEqual([b.id]);
	});

	it('refreshes an expired token, and renews a refused one once', async () => {
		const { connection, drive, tick } = await connected();
		tick(2 * 60 * 60 * 1000);
		await connection.upload(INFO, blob('a'));
		expect(drive.state.validToken).toBe('access-2');
		// Revoked early by Google: the next call gets 401, renews and goes through.
		drive.state.validToken = 'access-7';
		expect(await connection.list()).toHaveLength(1);
	});

	it('needs a new sign-in once the refresh token is refused', async () => {
		const { connection, drive, tick } = await connected();
		tick(2 * 60 * 60 * 1000);
		drive.state.refresh = { status: 400, error: 'invalid_grant' };
		await expect(connection.list()).rejects.toMatchObject({ code: 'CLOUD_AUTH_NEEDED' });
	});

	it('tells a full Drive, an outage and a refused scope apart', async () => {
		const { connection, drive } = await connected();
		drive.state.failNext = { status: 403, reason: 'storageQuotaExceeded' };
		await expect(connection.upload(INFO, blob('a'))).rejects.toMatchObject({
			code: 'CLOUD_STORAGE_FULL'
		});
		drive.state.failNext = { status: 503 };
		await expect(connection.list()).rejects.toMatchObject({ code: 'CLOUD_UNAVAILABLE' });
		drive.state.failNext = { status: 403, reason: 'userRateLimitExceeded' };
		await expect(connection.list()).rejects.toMatchObject({ code: 'CLOUD_UNAVAILABLE' });
		drive.state.failNext = { status: 403, reason: 'insufficientPermissions' };
		await expect(connection.list()).rejects.toMatchObject({ code: 'CLOUD_PERMISSION_DENIED' });
		drive.state.failNext = { status: 400, reason: 'invalid' };
		await expect(connection.list()).rejects.toMatchObject({ code: 'CLOUD_FAILED' });
	});

	it('forgets the connection and revokes it on disconnect', async () => {
		const { connection, provider, store, drive } = await connected();
		await connection.disconnect();
		expect(await store.get('google')).toBeNull();
		expect(await provider.resume()).toBeNull();
		expect(drive.state.calls).toContain('POST /revoke');
	});

	it('asks Google for offline access to drive.file', async () => {
		const opened: string[] = [];
		const store = memoryAuthStore();
		const provider = googleDrive({
			clientId: 'client-id',
			store,
			fetcher: fakeDrive().fetcher,
			signInDeps: () => ({
				...answeringPopup({ error: 'access_denied' })(),
				open: () => ({
					location: {
						set href(url: string) {
							opened.push(url);
						},
						get href() {
							return '';
						}
					},
					close() {}
				}),
				timeoutMs: 1
			})
		});
		expect(await provider.connect()).toBeNull();
		const params = new URL(opened[0]).searchParams;
		expect(params.get('scope')).toBe(DRIVE_SCOPE);
		expect(params.get('access_type')).toBe('offline');
		expect(params.get('prompt')).toBe('consent');
		expect(params.get('client_id')).toBe('client-id');
	});
});
