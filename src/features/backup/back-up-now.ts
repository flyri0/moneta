import { toast } from 'svelte-sonner';
import { runActionToast } from '$client/notify';
import { loadRegistry } from '$client/registry';
import type { ClientApi } from '$db/api';
import { m } from '$i18n/paraglide/messages';
import { backUp } from './actions';

/** "Back up now": backs up every budget, and warns in a toast about any that were left out. */
export function backUpNow(api: Pick<ClientApi, 'system'>): Promise<void> {
	return runActionToast(async () => {
		const skipped = await backUp(api);
		if (skipped.length === 0) return;
		const names = new Map(loadRegistry(localStorage).budgets.map((b) => [b.file, b.name]));
		toast.warning(m.backup_skipped({ names: skipped.map((f) => names.get(f) ?? f).join(', ') }));
	});
}
