import type { BackupTarget } from './target';

/** Saves backups as browser downloads. */
export const fileTarget: BackupTarget = {
	async save(fileName, data) {
		const url = URL.createObjectURL(data);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		// Some engines ignore clicks on an anchor outside the document.
		link.hidden = true;
		document.body.append(link);
		link.click();
		link.remove();
		// Give the browser time to start the download before the URL goes away.
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
};
