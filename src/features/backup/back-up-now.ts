import { toast } from 'svelte-sonner';
import { runActionToast } from '$client/notify';
import { loadRegistry } from '$client/registry';
import type { ClientApi } from '$db/api';
import { errorMessage } from '$i18n/errors';
import { m } from '$i18n/paraglide/messages';
import { backUp } from './actions';
import { fileTarget } from './file-target';
import type { BackupTarget } from './target';

/**
 * "Back up now": backs up every budget, and warns in a toast about any that were left out. When
 * the backup key can't be read, it offers to back up without encryption rather than decide alone.
 */
export function backUpNow(
	api: Pick<ClientApi, 'system'>,
	target: BackupTarget = fileTarget,
	plain = false
): Promise<void> {
	return runActionToast(async () => {
		let skipped: string[];
		try {
			skipped = await backUp(api, target, new Date(), { plain });
		} catch (err) {
			if ((err as { code?: unknown } | null)?.code !== 'BACKUP_KEYS_UNAVAILABLE') throw err;
			toast.error(errorMessage(err), {
				action: {
					label: m.backup_plain_anyway(),
					onClick: () => void backUpNow(api, target, true)
				}
			});
			return;
		}
		if (skipped.length === 0) return;
		const names = new Map(loadRegistry(localStorage).budgets.map((b) => [b.file, b.name]));
		toast.warning(m.backup_skipped({ names: skipped.map((f) => names.get(f) ?? f).join(', ') }));
	});
}
