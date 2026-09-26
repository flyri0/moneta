import { describe, it, expect } from 'vitest';
import { expiredBackups, KEEP_PREVIOUS } from './retention';
import type { RemoteBackup } from './provider';

function backup(day: string, device = 'me', modifiedAt = `${day}T12:00:00.000Z`): RemoteBackup {
	return {
		id: `${device}-${day}-${modifiedAt}`,
		name: `moneta-backup-${day}.moneta`,
		day,
		device,
		deviceLabel: device,
		modifiedAt,
		size: 1
	};
}

function days(count: number, device = 'me'): RemoteBackup[] {
	return Array.from({ length: count }, (_, i) =>
		backup(`2026-09-${String(i + 1).padStart(2, '0')}`, device)
	);
}

describe('expiredBackups', () => {
	it('keeps the newest day and the five before it', () => {
		expect(KEEP_PREVIOUS).toBe(5);
		expect(expiredBackups(days(6), 'me')).toEqual([]);
		const all = days(9);
		expect(expiredBackups(all, 'me').map((b) => b.day)).toEqual([
			'2026-09-01',
			'2026-09-02',
			'2026-09-03'
		]);
	});

	it("leaves other devices' backups alone", () => {
		const all = [...days(8, 'phone'), ...days(3, 'me')];
		expect(expiredBackups(all, 'me')).toEqual([]);
		expect(expiredBackups(all, 'phone').map((b) => b.device)).toEqual(['phone', 'phone']);
	});

	it('drops extra files of the same day, keeping the newest', () => {
		const older = backup('2026-09-02', 'me', '2026-09-02T08:00:00.000Z');
		const newer = backup('2026-09-02', 'me', '2026-09-02T20:00:00.000Z');
		expect(expiredBackups([older, newer, backup('2026-09-01')], 'me')).toEqual([older]);
	});

	it('works whatever order the list comes in', () => {
		const all = days(8).reverse();
		expect(expiredBackups(all, 'me').map((b) => b.day)).toEqual(['2026-09-01', '2026-09-02']);
	});
});
