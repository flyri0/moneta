import type { BudgetCopy, ClientApi } from '$db/api';
import type { BudgetMeta } from '$db/repos/meta';
import { transactionsCsv } from './export-csv';
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
 * records the date in each. Returns the files left out because they couldn't be read.
 */
export async function backUp(
	api: Pick<ClientApi, 'system'>,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<string[]> {
	const files = (await api.system.listFiles()).filter(isBudgetFile);
	const { bytes, skipped } = await api.system.exportBackup(files);
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
	const csv = transactionsCsv(await source.api.transactions.list(), source.meta.currency);
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
	const json = `${JSON.stringify(await source.api.backup.dump(), null, '\t')}\n`;
	await target.save(
		backupFileName(source.meta.name, 'json', now),
		new Blob([json], { type: 'application/json' })
	);
}
