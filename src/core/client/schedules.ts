import { toast } from 'svelte-sonner';
import type { ClientApi } from '$db/api';
import { todayIso } from '$domain/month';
import { m } from '$i18n/paraglide/messages';
import { notifyError } from './notify';

/**
 * A function that enters the due occurrences of automatic schedules, at most once a day (a failed
 * run is tried again next time). It resolves to how many transactions it entered.
 */
export function scheduleRunner(
	api: { schedules: Pick<ClientApi['schedules'], 'enterDue'> },
	today: () => string = () => todayIso()
): () => Promise<number> {
	let done: string | null = null;
	return async () => {
		const date = today();
		if (date === done) return 0;
		const count = await api.schedules.enterDue(date);
		done = date;
		return count;
	};
}

/** Runs `enter` (a schedule run) and says how many transactions it entered; failures toast. */
export async function enterAndReport(enter: () => Promise<number>): Promise<void> {
	try {
		const count = await enter();
		if (count > 0) toast.success(m.schedules_entered({ count }));
	} catch (err) {
		notifyError(err);
	}
}
