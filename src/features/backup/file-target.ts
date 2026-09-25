import type { BackupTarget, SaveResult } from './target';

/** The File System Access save picker, where the browser has one (Chromium on desktop). */
type SaveFilePicker = (options: { suggestedName: string }) => Promise<{
	createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}>;

/**
 * Saves backups as files. With a save picker the user chooses where, and the result is known;
 * without one the file is a browser download, which may still be refused or cancelled, unseen.
 */
export const fileTarget: BackupTarget = {
	async save(fileName, data): Promise<SaveResult> {
		const pick = (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
		if (pick) {
			let handle: Awaited<ReturnType<SaveFilePicker>>;
			try {
				handle = await pick({ suggestedName: fileName });
			} catch (err) {
				if ((err as { name?: unknown } | null)?.name !== 'AbortError') throw err;
				// Cancelled: the data is no longer wanted, but it may still fail.
				Promise.resolve(data).catch(() => {});
				return 'cancelled';
			}
			const blob = await data;
			const file = await handle.createWritable();
			await file.write(blob);
			await file.close();
			return 'saved';
		}
		const url = URL.createObjectURL(await data);
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
		return 'unknown';
	}
};
