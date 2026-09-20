import { untrack } from 'svelte';
import type { Table } from '$db/connection';
import { liveQuery, type LiveState } from './live';
import type { RpcClient } from './rpc';

/**
 * Component-friendly liveQuery. `fetch` runs now and again after every write that touches
 * `tables`. Reactive values that `fetch` reads before its first `await` are tracked, so the
 * query restarts when they change (e.g. the month in the URL). While a restarted query loads,
 * the previous data stays visible.
 */
export function useLive<T>(
	client: Pick<RpcClient, 'onChange'>,
	tables: readonly Table[],
	fetch: () => Promise<T>
): LiveState<T> {
	let state = $state<LiveState<T>>({ data: undefined, error: undefined, loading: true });
	$effect(() => {
		const store = liveQuery(client, tables, fetch);
		return store.subscribe((next) => {
			untrack(() => {
				state = next.data === undefined && next.loading ? { ...next, data: state.data } : next;
			});
		});
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
		}
	};
}
