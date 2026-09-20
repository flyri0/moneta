import { describe, it, expect } from 'vitest';
import { backupDue } from './reminder';

const now = new Date('2026-09-19T12:00:00Z');

describe('backupDue', () => {
	it('is due 14 days after the last backup', () => {
		const meta = { createdAt: '2026-01-01T00:00:00Z' };
		expect(backupDue({ ...meta, lastBackupAt: '2026-09-06T12:00:00Z' }, now)).toBe(false);
		expect(backupDue({ ...meta, lastBackupAt: '2026-09-05T12:00:00Z' }, now)).toBe(true);
	});

	it('counts from the creation date when there was never a backup', () => {
		expect(backupDue({ createdAt: '2026-09-10T00:00:00Z', lastBackupAt: null }, now)).toBe(false);
		expect(backupDue({ createdAt: '2026-08-01T00:00:00Z', lastBackupAt: null }, now)).toBe(true);
	});
});
