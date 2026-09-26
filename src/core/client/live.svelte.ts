import { untrack } from 'svelte';
import type { Table } from '$db/connection';
import { liveQuery, type LiveState } from './live';
import { startLoad } from './pending';
import type { RpcClient } from './rpc';

/** A live query's state in a component. */
export interface LiveView<T> extends LiveState<T> {
	/** The data is from before the arguments changed, and the result for the new ones is on its way. */
	stale: boolean;
}

/**
 * Component-friendly liveQuery. `fetch` runs now and again after every write that touches
 * `tables`. Reactive values that `fetch` reads before its first `await` are tracked, so the
 * query restarts when they change (e.g. the month in the URL). While a restarted query loads,
 * the previous data stays visible, marked `stale`. Until a query (or a restarted one) has its
 * first result it counts in `pendingLoads`, which drives the loading bar.
 */
export function useLive<T>(
	client: Pick<RpcClient, 'onChange'>,
	tables: readonly Table[],
	fetch: () => Promise<T>
): LiveView<T> {
	// Replaced whole on every result, never changed in place: no need for a deep proxy.
	let state = $state.raw<LiveView<T>>({
		data: undefined,
		error: undefined,
		loading: true,
		stale: false
	});
	$effect(() => {
		const store = liveQuery(client, tables, fetch);
		const end = startLoad();
		const off = store.subscribe((next) => {
			if (!next.loading) end();
			untrack(() => {
				const waiting = next.data === undefined && next.loading;
				state =
					waiting && state.data !== undefined
						? { ...next, data: state.data, stale: true }
						: { ...next, stale: false };
			});
		});
		return () => {
			off();
			end();
		};
	});
	return {
		get data() {
			return state.data;
		},
		get error() {
			return state.error;
		},
		get loading() {
			return state.loading;
		},
		get stale() {
			return state.stale;
		}
	};
}
