import { describe, it, expect } from 'vitest';
import { backupFileName } from './target';

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
