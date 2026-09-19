import type { BackupTarget } from './target';

/** Saves backups as browser downloads. */
export const fileTarget: BackupTarget = {
	async save(fileName, data) {
		const url = URL.createObjectURL(data);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		// Give the browser time to start the download before the URL goes away.
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
};
