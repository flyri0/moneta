import type { BudgetMeta } from '$db/repos/meta';

const REMINDER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True once a budget has gone 14 days without a `.sqlite` backup (or since it was created). */
export function backupDue(
	meta: Pick<BudgetMeta, 'createdAt' | 'lastBackupAt'>,
	now: Date = new Date()
): boolean {
	const since = Date.parse(meta.lastBackupAt ?? meta.createdAt);
	return Number.isFinite(since) && now.getTime() - since >= REMINDER_DAYS * DAY_MS;
}
