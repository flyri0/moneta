import { useSession } from '$client/app-state.svelte';
import { useLive, type LiveView } from '$client/live.svelte';
import type { FlagRow } from '$db/repos/flags';

/** The six flags and their names, kept live. Call during component initialization. */
export function useFlags(): LiveView<FlagRow[]> {
	const session = useSession();
	return useLive(session.client, ['flags'], () => session.api.flags.list());
}
