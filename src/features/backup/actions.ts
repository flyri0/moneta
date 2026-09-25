import type { BudgetCopy, ClientApi } from '$db/api';
import type { BudgetMeta } from '$db/repos/meta';
import { fileTarget } from './file-target';
import { isBudgetFile } from '$client/registry';
import {
	backupFileName,
	copyBackupFileName,
	encryptedBackupFileName,
	fullBackupFileName,
	type BackupTarget,
	type SaveResult
} from './target';

/** What the exports need from the open budget (a BudgetSession in the app). */
export interface ExportSource {
	api: ClientApi;
	meta: BudgetMeta;
}

/** A `.moneta` file is a ZIP, but it is saved as an opaque file so browsers keep its extension. */
const BACKUP_TYPE = 'application/octet-stream';

/** What a backup did: the files it left out, and whether the target knows the file was saved. */
export interface BackupDone {
	skipped: string[];
	result: SaveResult;
	/** The budget files it holds, and when it was made: what `markBackedUp` records. */
	files: string[];
	at: string;
}

/**
 * Saves every budget on this device as one `.moneta` file (the backup that can be restored).
 * The date is recorded in each budget only when the target says the file was saved; when it
 * can't tell (`unknown`), the caller asks the user and calls `markBackedUp`. `plain` skips
 * encryption (see BACKUP_KEYS_UNAVAILABLE).
 */
export async function backUp(
	api: Pick<ClientApi, 'system'>,
	target: BackupTarget = fileTarget,
	now = new Date(),
	options: { plain?: boolean } = {}
): Promise<BackupDone> {
	const files = (await api.system.listFiles()).filter(isBudgetFile);
	const encrypted = !options.plain && (await isEncrypting(api));
	const exported = api.system.exportBackup(files, options.plain ? options : undefined);
	const result = await target.save(
		encrypted ? encryptedBackupFileName(now) : fullBackupFileName(now),
		exported.then(({ bytes }) => new Blob([bytes], { type: BACKUP_TYPE }))
	);
	const { skipped } = await exported;
	const done = {
		skipped,
		result,
		files: files.filter((f) => !skipped.includes(f)),
		at: now.toISOString()
	};
	if (result === 'saved') await markBackedUp(api, done);
	return done;
}

/** Records a backup's date in each budget it holds. */
export async function markBackedUp(
	api: Pick<ClientApi, 'system'>,
	done: Pick<BackupDone, 'files' | 'at'>
): Promise<void> {
	await api.system.markBackedUp(done.files, done.at);
}

/**
 * Saves a budget's saved copy as a `.moneta` backup, named for the day it was saved. Restoring it
 * replaces that budget.
 */
export async function downloadCopy(
	api: Pick<ClientApi, 'system'>,
	copy: BudgetCopy,
	budgetName: string,
	target: BackupTarget = fileTarget
): Promise<void> {
	const savedAt = new Date(copy.savedAt);
	const encrypted = await isEncrypting(api);
	await target.save(
		encrypted ? encryptedBackupFileName(savedAt) : copyBackupFileName(budgetName, savedAt),
		api.system
			.exportBackup([copy.name])
			.then(({ bytes }) => new Blob([bytes], { type: BACKUP_TYPE }))
	);
}

/**
 * Whether backups will be encrypted, known before the file is named (the name of an encrypted
 * one gives nothing away). If the key can't be read, the export itself reports it.
 */
function isEncrypting(api: Pick<ClientApi, 'system'>): Promise<boolean> {
	return api.system.backupEncryption().then(
		({ on }) => on,
		() => false
	);
}

export async function exportTransactionsCsv(
	source: ExportSource,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<void> {
	const csv = await source.api.backup.csv();
	await target.save(
		backupFileName(source.meta.name, 'csv', now),
		new Blob([csv], { type: 'text/csv;charset=utf-8' })
	);
}

export async function exportBudgetJson(
	source: ExportSource,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<void> {
	const json = await source.api.backup.json();
	await target.save(
		backupFileName(source.meta.name, 'json', now),
		new Blob([json], { type: 'application/json' })
	);
}

/** A picked backup file, and whether it has to be unlocked (`api.system.unlockBackup`) first. */
export async function readBackupFile(
	api: Pick<ClientApi, 'system'>,
	file: Blob
): Promise<{ bytes: Uint8Array; encrypted: boolean }> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	return { bytes, encrypted: await api.system.isEncryptedBackup(bytes) };
}
