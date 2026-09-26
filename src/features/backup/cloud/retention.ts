import type { RemoteBackup } from './provider';

/** How many earlier days of backups a device keeps, besides its newest. */
export const KEEP_PREVIOUS = 5;

/**
 * The backups of `device` to delete, oldest first. A device keeps one file per day: its newest
 * day and the `keepPrevious` days before it. Other devices' backups are theirs to rotate.
 */
export function expiredBackups(
	backups: readonly RemoteBackup[],
	device: string,
	keepPrevious = KEEP_PREVIOUS
): RemoteBackup[] {
	const newestFirst = backups
		.filter((b) => b.device === device)
		.sort((a, b) => b.day.localeCompare(a.day) || b.modifiedAt.localeCompare(a.modifiedAt));
	const days = new Set<string>();
	const expired: RemoteBackup[] = [];
	for (const backup of newestFirst) {
		if (days.has(backup.day) || days.size > keepPrevious) expired.push(backup);
		else days.add(backup.day);
	}
	return expired.reverse();
}
