import { todayIso } from '$domain/month';

/** The extension of a backup that can be restored. */
export const BACKUP_EXTENSION = 'moneta';
/** What the restore pickers accept: `.moneta` backups, and `.sqlite` ones from before them. */
export const BACKUP_ACCEPT =
	'.moneta,.sqlite,.sqlite3,.db,application/vnd.sqlite3,application/x-sqlite3';

/**
 * Where backups and exports go. v1 has one target that downloads files (`file-target.ts`);
 * cloud targets would implement the same interface.
 */
export interface BackupTarget {
	save(fileName: string, data: Blob): Promise<void>;
}

/** A budget name as ASCII only, safe on any file system: `Casa & Família` → `casa-familia`. */
function slugOf(budgetName: string): string {
	return (
		budgetName
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'budget'
	);
}

/** The local date and time to the second, e.g. `2026-09-19-233005` (no `:`, which Windows rejects). */
function backupStamp(now: Date): string {
	const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
		.map((n) => String(n).padStart(2, '0'))
		.join('');
	return `${todayIso(now)}-${time}`;
}

/** e.g. `moneta-casa-familia-2026-09-19.csv`, for exports. */
export function backupFileName(budgetName: string, extension: string, now = new Date()): string {
	return `moneta-${slugOf(budgetName)}-${todayIso(now)}.${extension}`;
}

/** The name of a backup of every budget, e.g. `moneta-backup-2026-09-19-233005.moneta`. */
export function fullBackupFileName(now = new Date()): string {
	return `moneta-backup-${backupStamp(now)}.${BACKUP_EXTENSION}`;
}

/** The name of a backup of one budget, e.g. `moneta-casa-familia-2026-08-01-120000.moneta`. */
export function copyBackupFileName(budgetName: string, savedAt: Date): string {
	return `moneta-${slugOf(budgetName)}-${backupStamp(savedAt)}.${BACKUP_EXTENSION}`;
}
