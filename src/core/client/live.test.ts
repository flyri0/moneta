import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { liveQuery, type LiveState } from './live';
import type { ChangeListener } from './rpc';
import type { Table } from '$db/connection';

function fakeClient() {
	const listeners = new Set<ChangeListener>();
	return {
		onChange(l: ChangeListener) {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		emit(tables: Table[]) {
			for (const l of listeners) l(tables);
		},
		get listenerCount() {
			return listeners.size;
		}
	};
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('liveQuery', () => {
	it('loads on subscribe and refetches when a watched table changes', async () => {
		const client = fakeClient();
		let n = 0;
		const store = liveQuery(client, ['accounts'], async () => ++n);
		const states: LiveState<number>[] = [];
		const unsub = store.subscribe((s) => states.push(s));
		await flush();
		expect(get(store)).toEqual({ data: 1, error: undefined, loading: false });

		client.emit(['payees']);
		await flush();
		expect(n).toBe(1);

		client.emit(['transactions', 'accounts']);
		await flush();
		expect(get(store).data).toBe(2);
		unsub();
		expect(client.listenerCount).toBe(0);
	});

	it('keeps the last data and exposes errors', async () => {
		const client = fakeClient();
		let fail = false;
		const store = liveQuery(client, ['accounts'], async () => {
			if (fail) throw new Error('boom');
			return 'ok';
		});
		const unsub = store.subscribe(() => {});
		await flush();
		fail = true;
		client.emit(['accounts']);
		await flush();
		expect(get(store)).toMatchObject({ data: 'ok', loading: false, error: expect.any(Error) });
		unsub();
	});

	it('folds the changes made during a fetch into one more fetch, whose result wins', async () => {
		const client = fakeClient();
		const resolvers: ((v: string) => void)[] = [];
		const store = liveQuery(
			client,
			['accounts'],
			() => new Promise<string>((r) => resolvers.push(r))
		);
		const unsub = store.subscribe(() => {});
		for (let i = 0; i < 5; i++) client.emit(['accounts']);
		expect(resolvers).toHaveLength(1);
		resolvers[0]('stale');
		await flush();
		expect(resolvers).toHaveLength(2);
		expect(get(store)).toMatchObject({ data: undefined, loading: true });
		resolvers[1]('fresh');
		await flush();
		expect(resolvers).toHaveLength(2);
		expect(get(store)).toEqual({ data: 'fresh', error: undefined, loading: false });
		unsub();
	});
});
