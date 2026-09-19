import { describe, it, expect, afterEach } from 'vitest';
import { createRpcClient, RpcError } from './rpc';
import { createDispatcher } from '$lib/db/dispatcher';
import { createBudgetDb } from '$lib/db/testing';
import type { Db } from '$lib/db/connection';
import type { Table } from '$lib/db/connection';

const channels: MessageChannel[] = [];
afterEach(() => {
	for (const c of channels.splice(0)) {
		c.port1.close();
		c.port2.close();
	}
});

/** Wires a client to a dispatcher over a real MessageChannel, like the worker does. */
function connect(db: Db | null) {
	const channel = new MessageChannel();
	channels.push(channel);
	const dispatch = createDispatcher({
		getDb: () => db,
		system: { open: () => {}, close: () => {}, listFiles: () => [], deleteFile: () => {} }
	});
	channel.port2.onmessage = async (e) => channel.port2.postMessage(await dispatch(e.data));
	return createRpcClient(channel.port1);
}

describe('createRpcClient', () => {
	it('calls handlers through a typed proxy', async () => {
		const client = connect(await createBudgetDb());
		const meta = await client.api.meta.get();
		expect(meta.name).toBe('Test Budget');
	});

	it('rejects with RpcError carrying the error code', async () => {
		const client = connect(await createBudgetDb());
		const err = await client.api.budget.month('bad').catch((e) => e);
		expect(err).toBeInstanceOf(RpcError);
		expect(err.code).toBe('INVALID_INPUT');
	});

	it('notifies change listeners after writes only', async () => {
		const client = connect(await createBudgetDb());
		const seen: Table[][] = [];
		const off = client.onChange((t) => seen.push(t));
		await client.api.accounts.list();
		await client.api.accounts.create({
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		expect(seen).toHaveLength(1);
		expect(seen[0]).toContain('accounts');
		off();
		await client.api.accounts.create({
			name: 'Bank 2',
			type: 'checking',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		expect(seen).toHaveLength(1);
	});

	it('is not mistaken for a thenable', async () => {
		const client = connect(await createBudgetDb());
		expect((client.api as unknown as { then?: unknown }).then).toBeUndefined();
	});
});
