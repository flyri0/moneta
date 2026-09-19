import type { ClientApi } from '$lib/db/api';
import type { BudgetMeta } from '$lib/db/repos/meta';
import { transactionsCsv } from './export-csv';
import { fileTarget } from './file-target';
import { backupFileName, type BackupTarget } from './target';

/** What the exports need from the open budget (a BudgetSession in the app). */
export interface ExportSource {
	api: ClientApi;
	meta: BudgetMeta;
}

/** Saves the open budget as a `.sqlite` file (the backup that can be restored). */
export async function backUp(
	source: ExportSource,
	target: BackupTarget = fileTarget,
	now = new Date()
): Promise<void> {
	const bytes = await source.api.system.exportFile();
	await target.save(
		backupFileName(source.meta.name, 'sqlite', now),
		new Blob([bytes], { type: 'application/vnd.sqlite3' })
	);
	await source.api.meta.update({ lastBackupAt: now.toISOString() });
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
