import { describe, it, expect, afterEach } from 'vitest';
import { createBudget, type NewBudget } from '$client/session';
import { createTestClient, memoryStore } from '$client/testing';
import { newRecoveryKey } from '$domain/recovery-key';
import { backUpToCloud, type CloudDevice } from './cloud-backup';
import { connectedDrive } from './testing';
import type { CloudConnection } from './provider';

const HOME: NewBudget = {
	name: 'Home',
	currency: 'USD',
	locale: 'en-US',
	groups: [{ name: 'Everyday', categories: ['Food'] }],
	account: {
		name: 'Checking',
		type: 'checking',
		onBudget: true,
		startingBalance: 150000,
		startingDate: '2026-09-01'
	}
};

const DEVICE: CloudDevice = { device: 'laptop', deviceLabel: 'Firefox · Linux' };

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

async function setup({ encrypted = true } = {}) {
	const test = await createTestClient();
	clients.push(test);
	const api = test.client.api;
	await createBudget(api, memoryStore(), HOME);
	if (encrypted) await api.system.setBackupEncryption('correct horse', newRecoveryKey());
	const { drive, connection } = await connectedDrive();
	return { api, drive, connection };
}

describe('backUpToCloud', () => {
	it('saves an encrypted backup of every budget and records it', async () => {
		const { api, connection, drive } = await setup();
		const now = new Date(2026, 8, 26, 10, 0);
		const done = await backUpToCloud(api, connection, DEVICE, now);
		expect(done.result).toBe('saved');
		expect(drive.backups()).toEqual(['2026-09-26 laptop']);
		const [saved] = await connection.list();
		expect(saved).toMatchObject({ name: 'moneta-backup-2026-09-26.moneta', ...DEVICE });
		const bytes = new Uint8Array(await (await connection.download(saved.id)).arrayBuffer());
		expect(await api.system.isEncryptedBackup(bytes)).toBe(true);
		expect((await api.meta.get()).lastBackupAt).toBe(now.toISOString());
	});

	it('refuses to save a backup that is not encrypted', async () => {
		const { api, connection, drive } = await setup({ encrypted: false });
		await expect(backUpToCloud(api, connection, DEVICE)).rejects.toMatchObject({
			code: 'CLOUD_NOT_ENCRYPTED'
		});
		expect(drive.backups()).toEqual([]);
		expect((await api.meta.get()).lastBackupAt).toBeNull();
	});

	it('keeps the newest day and five before it, deleting the oldest', async () => {
		const { api, connection, drive } = await setup();
		for (let day = 1; day <= 8; day++)
			await backUpToCloud(api, connection, DEVICE, new Date(2026, 8, day, 10, 0));
		// Another device's backups are left alone.
		await backUpToCloud(
			api,
			connection,
			{ device: 'phone', deviceLabel: 'x' },
			new Date(2026, 7, 1)
		);
		expect(drive.backups()).toEqual([
			'2026-09-03 laptop',
			'2026-09-04 laptop',
			'2026-09-05 laptop',
			'2026-09-06 laptop',
			'2026-09-07 laptop',
			'2026-09-08 laptop',
			'2026-08-01 phone'
		]);
	});

	it('still counts the backup as saved when rotation fails', async () => {
		const { api, connection, drive } = await setup();
		const failing: CloudConnection = {
			...connection,
			upload: (info, data) => connection.upload(info, data),
			list: async () => {
				throw new Error('offline');
			}
		};
		expect((await backUpToCloud(api, failing, DEVICE)).result).toBe('saved');
		expect(drive.backups()).toHaveLength(1);
	});
});
