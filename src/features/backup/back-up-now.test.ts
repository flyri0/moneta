import { describe, it, expect, vi } from 'vitest';

const { errorMock, warningMock } = vi.hoisted(() => ({ errorMock: vi.fn(), warningMock: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: errorMock, warning: warningMock } }));

import { RpcError } from '$client/rpc';
import type { ClientApi } from '$db/api';
import { backUpNow } from './back-up-now';
import type { BackupTarget } from './target';

describe('backUpNow', () => {
	it('offers a plain backup when the backup key cannot be read', async () => {
		const calls: unknown[] = [];
		const api = {
			system: {
				listFiles: async () => ['budget-0190a000-0000-7000-8000-000000000001.sqlite3'],
				exportBackup: async (_names: string[], options?: { plain?: boolean }) => {
					calls.push(options);
					if (!options?.plain) throw new RpcError('BACKUP_KEYS_UNAVAILABLE', 'no IndexedDB');
					return { bytes: new Uint8Array(4), skipped: [], encrypted: false };
				},
				markBackedUp: async () => {}
			}
		} as unknown as Pick<ClientApi, 'system'>;
		const saved: string[] = [];
		const target: BackupTarget = { save: async (name) => void saved.push(name) };

		await backUpNow(api, target);
		expect(saved).toEqual([]);
		expect(errorMock).toHaveBeenCalledTimes(1);
		const { action } = errorMock.mock.calls[0][1] as { action: { label: string; onClick(): void } };
		expect(action.label).toBe('Back up without encryption');

		action.onClick();
		await vi.waitFor(() => expect(saved).toHaveLength(1));
		expect(calls).toEqual([undefined, { plain: true }]);
	});
});
