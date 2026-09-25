import type { BudgetCopy, ClientApi } from '$db/api';
import type { BudgetMeta } from '$db/repos/meta';
import { fileTarget } from './file-target';
import { isBudgetFile } from '$client/registry';
import {
	backupFileName,
	copyBackupFileName,
	fullBackupFileName,
	type BackupTarget
} from './target';

/** What the exports need from the open budget (a BudgetSession in the app). */
export interface ExportSource {
	api: ClientApi;
	meta: BudgetMeta;
}

/** A `.moneta` file is a ZIP, but it is saved as an opaque file so browsers keep its extension. */
const BACKUP_TYPE = 'application/octet-stream';

/**
 * Saves every budget on this device as one `.moneta` file (the backup that can be restored) and
 * records the date in each. `plain` skips encryption (see BACKUP_KEYS_UNAVAILABLE). Returns the files left out because they couldn't be read.
 */
export async function backUp(
	api: Pick<ClientApi, 'system'>,
	target: BackupTarget = fileTarget,
	now = new Date(),
	options: { plain?: boolean } = {}
): Promise<string[]> {
	const files = (await api.system.listFiles()).filter(isBudgetFile);
	const { bytes, skipped } = await api.system.exportBackup(
		files,
		options.plain ? options : undefined
	);
	await target.save(fullBackupFileName(now), new Blob([bytes], { type: BACKUP_TYPE }));
	await api.system.markBackedUp(
		files.filter((f) => !skipped.includes(f)),
		now.toISOString()
	);
	return skipped;
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
	const { bytes } = await api.system.exportBackup([copy.name]);
	await target.save(
		copyBackupFileName(budgetName, new Date(copy.savedAt)),
		new Blob([bytes], { type: BACKUP_TYPE })
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
