import { describe, it, expect, afterEach } from 'vitest';
import { fileTarget } from './file-target';

const unhandled: unknown[] = [];
const record = (reason: unknown) => void unhandled.push(reason);

afterEach(() => {
	process.off('unhandledRejection', record);
	delete (globalThis as { window?: unknown }).window;
});

describe('fileTarget with a save picker', () => {
	it('reports data that fails while the picker is open once, as its error', async () => {
		process.on('unhandledRejection', record);
		const written: Blob[] = [];
		(globalThis as { window?: unknown }).window = {
			// The picker answers in a later task, as a real dialog does.
			showSaveFilePicker: () =>
				new Promise((resolve) =>
					setTimeout(() =>
						resolve({
							createWritable: async () => ({
								write: async (data: Blob) => void written.push(data),
								close: async () => {}
							})
						})
					)
				)
		};
		const failure = new Error('export failed');
		await expect(fileTarget.save('backup.moneta', Promise.reject(failure))).rejects.toBe(failure);
		await new Promise((r) => setTimeout(r, 10));
		expect(unhandled).toEqual([]);
		expect(written).toEqual([]);
	});
});
