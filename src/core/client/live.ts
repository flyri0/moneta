import { readable, type Readable } from 'svelte/store';
import type { Table } from '$db/connection';
import type { RpcClient } from './rpc';

export interface LiveState<T> {
	data: T | undefined;
	error: unknown;
	loading: boolean;
}

/**
 * A store that runs `fetch` on subscribe and again whenever a write changes one of `tables`.
 * One fetch runs at a time: changes made while it runs fold into a single fetch after it, and
 * the result of a fetch that changes overtook is dropped for that one.
 */
export function liveQuery<T>(
	client: Pick<RpcClient, 'onChange'>,
	tables: readonly Table[],
	fetch: () => Promise<T>
): Readable<LiveState<T>> {
	return readable<LiveState<T>>(
		{ data: undefined, error: undefined, loading: true },
		(set, update) => {
			let active = true;
			let running = false;
			let dirty = false;
			const refresh = () => {
				if (running) {
					dirty = true;
					return;
				}
				running = true;
				dirty = false;
				update((s) => ({ ...s, loading: true }));
				const settle = (apply: () => void) => {
					running = false;
					if (!active) return;
					if (dirty) refresh();
					else apply();
				};
				fetch().then(
					(data) => settle(() => set({ data, error: undefined, loading: false })),
					(error: unknown) => settle(() => update((s) => ({ ...s, error, loading: false })))
				);
			};
			refresh();
			const off = client.onChange((changed) => {
				if (changed.some((t) => tables.includes(t))) refresh();
			});
			return () => {
				active = false;
				off();
			};
		}
	);
}
