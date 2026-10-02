import type { ClientApi } from '$db/api';
import { DomainError } from '$domain/errors';
import { todayIso } from '$domain/month';
import { backUp, type BackupDone } from '../actions';
import type { BackupTarget } from '../target';
import { expiredBackups } from './retention';
import type { CloudConnection } from './provider';

/** This device, as its backups name it in the cloud. */
export interface CloudDevice {
	device: string;
	deviceLabel: string;
}

/**
 * A target that saves into the cloud: the day's file of this device. It checks the bytes it is
 * given: a backup that isn't encrypted never leaves the device.
 */
function cloudTarget(
	api: Pick<ClientApi, 'system'>,
	connection: CloudConnection,
	device: CloudDevice,
	now: Date
): BackupTarget {
	return {
		async save(fileName, data) {
			const blob = await data;
			const bytes = new Uint8Array(await blob.arrayBuffer());
			if (!(await api.system.isEncryptedBackup(bytes)))
				throw new DomainError('CLOUD_NOT_ENCRYPTED');
			await connection.upload({ name: fileName, day: todayIso(now), ...device }, blob);
			return 'saved';
		}
	};
}

/**
 * `api` with an export that fails when a budget was left out (or none is left): the day's file
 * replaces the one already in the cloud, and rotation deletes older days, so a backup missing a
 * budget must never get that far.
 */
function whole(api: Pick<ClientApi, 'system'>): Pick<ClientApi, 'system'> {
	return {
		system: new Proxy(api.system, {
			get(target, key) {
				if (key !== 'exportBackup') return target[key as keyof typeof target];
				return async (...args: Parameters<typeof target.exportBackup>) => {
					const exported = await target.exportBackup(...args);
					if (exported.skipped.length > 0 || args[0].length === exported.skipped.length)
						throw new DomainError('BACKUP_INCOMPLETE', exported.skipped.join(', '));
					return exported;
				};
			}
		})
	};
}

/**
 * Backs up every budget into the cloud, encrypted with this device's key (no password asked), and
 * records it in each budget. Then deletes this device's oldest backups past the ones it keeps
 * (`retention.ts`); a failed cleanup waits for the next backup.
 */
export async function backUpToCloud(
	api: Pick<ClientApi, 'system'>,
	connection: CloudConnection,
	device: CloudDevice,
	now = new Date()
): Promise<BackupDone> {
	let encrypted: boolean;
	try {
		({ on: encrypted } = await api.system.backupEncryption());
	} catch (err) {
		throw new DomainError('BACKUP_KEYS_UNAVAILABLE', String(err));
	}
	if (!encrypted) throw new DomainError('CLOUD_NOT_ENCRYPTED');
	const done = await backUp(whole(api), cloudTarget(api, connection, device, now), now);
	try {
		for (const old of expiredBackups(await connection.list(), device.device))
			await connection.remove(old.id);
	} catch {
		// The backup is saved; the next one deletes what this one couldn't.
	}
	return done;
}
