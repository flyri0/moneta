import { todayIso } from '$domain/month';

/**
 * Where backups and exports go. v1 has one target that downloads files (`file-target.ts`);
 * cloud targets would implement the same interface.
 */
export interface BackupTarget {
	save(fileName: string, data: Blob): Promise<void>;
}

/** e.g. `moneta-casa-familia-2026-09-19.sqlite`: ASCII only, safe on any file system. */
export function backupFileName(budgetName: string, extension: string, now = new Date()): string {
	const slug =
		budgetName
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'budget';
	return `moneta-${slug}-${todayIso(now)}.${extension}`;
}
