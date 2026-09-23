import { describe, it, expect } from 'vitest';
import { backupFileName, copyBackupFileName, fullBackupFileName } from './target';

describe('backupFileName', () => {
	const day = new Date(2026, 8, 19, 23, 30);

	it('names the file after the budget and the local date', () => {
		expect(backupFileName('Home', 'sqlite', day)).toBe('moneta-home-2026-09-19.sqlite');
	});

	it('keeps the name readable and safe for any file system', () => {
		expect(backupFileName('Casa & Família 2026', 'csv', day)).toBe(
			'moneta-casa-familia-2026-2026-09-19.csv'
		);
		expect(backupFileName('???', 'json', day)).toBe('moneta-budget-2026-09-19.json');
	});
});

describe('fullBackupFileName / copyBackupFileName', () => {
	it('names a backup after the local date and time, to the second', () => {
		expect(fullBackupFileName(new Date(2026, 8, 19, 23, 30, 5))).toBe(
			'moneta-backup-2026-09-19-233005.moneta'
		);
		expect(fullBackupFileName(new Date(2026, 0, 2, 3, 4, 5))).toBe(
			'moneta-backup-2026-01-02-030405.moneta'
		);
	});

	it('names a backup of one budget after the budget too', () => {
		expect(copyBackupFileName('Casa & Família', new Date(2026, 7, 1, 9, 0, 0))).toBe(
			'moneta-casa-familia-2026-08-01-090000.moneta'
		);
	});
});
