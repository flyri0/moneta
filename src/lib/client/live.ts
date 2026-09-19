import { readable, type Readable } from 'svelte/store';
import type { Table } from '$lib/db/connection';
import type { RpcClient } from './rpc';

export interface LiveState<T> {
	data: T | undefined;
	error: unknown;
	loading: boolean;
}

/**
 * A store that runs `fetch` on subscribe and again whenever a write changes
 * one of `tables`. Out-of-order results from older runs are ignored.
 */
export function liveQuery<T>(
	client: Pick<RpcClient, 'onChange'>,
	tables: readonly Table[],
	fetch: () => Promise<T>
): Readable<LiveState<T>> {
	return readable<LiveState<T>>(
		{ data: undefined, error: undefined, loading: true },
		(set, update) => {
			let run = 0;
			let active = true;
			const refresh = () => {
				const mine = ++run;
				update((s) => ({ ...s, loading: true }));
				fetch().then(
					(data) => {
						if (active && mine === run) set({ data, error: undefined, loading: false });
					},
					(error: unknown) => {
						if (active && mine === run) update((s) => ({ ...s, error, loading: false }));
					}
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
