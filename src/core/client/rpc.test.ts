import { describe, it, expect, afterEach } from 'vitest';
import { createRpcClient, RpcError, type Endpoint } from './rpc';
import { createDispatcher } from '$db/dispatcher';
import { createBudgetDb } from '$db/testing';
import type { Db } from '$db/connection';
import type { Table } from '$db/connection';

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
		system: {
			open: async () => {},
			close: () => {},
			listFiles: () => [],
			deleteFile: () => {},
			release: () => {},
			listCopies: () => [],
			readCopy: () => new Uint8Array(),
			exportBackup: () => ({ bytes: new Uint8Array(), skipped: [] }),
			markBackedUp: () => {},
			inspectBackup: () => ({ createdAt: null, budgets: [] }),
			restoreBackup: async () => {}
		}
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

/** An endpoint that clones messages like a real port but never answers. */
function silentEndpoint() {
	const listeners = new Map<string, ((event: MessageEvent) => void)[]>();
	const sent: unknown[] = [];
	const endpoint: Endpoint = {
		postMessage: (message) => void sent.push(structuredClone(message)),
		addEventListener: (type, listener) =>
			void listeners.set(type, [...(listeners.get(type) ?? []), listener])
	};
	const emit = (type: string) => {
		for (const listener of listeners.get(type) ?? []) listener(new MessageEvent(type));
	};
	return { endpoint, sent, emit };
}

describe('createRpcClient failure paths', () => {
	it('sends reactive proxies by value', async () => {
		const client = connect(await createBudgetDb());
		const input = new Proxy(
			{
				name: 'Bank',
				type: 'checking' as const,
				onBudget: true,
				startingBalance: 0,
				startingDate: '2026-01-01'
			},
			{}
		);
		await client.api.accounts.create(input);
		expect((await client.api.accounts.list()).map((a) => a.name)).toEqual(['Bank']);
	});

	it('rejects, instead of hanging, when a message cannot be sent', async () => {
		const { endpoint, sent } = silentEndpoint();
		const client = createRpcClient(endpoint);
		const notCloneable = (() => 'x') as unknown as string;
		const err = await client.api.accounts.rename('id', notCloneable).catch((e) => e);
		expect(err).toBeInstanceOf(RpcError);
		expect(err.code).toBe('INTERNAL');
		expect(sent).toEqual([]);
	});

	it.each(['error', 'messageerror'])('fails every pending and later call on %s', async (type) => {
		const { endpoint, emit } = silentEndpoint();
		const client = createRpcClient(endpoint);
		const fatal: RpcError[] = [];
		client.onFatal((e) => fatal.push(e));
		const pending = client.api.meta.get().catch((e) => e);
		emit(type);
		emit(type);
		expect(await pending).toMatchObject({ code: 'WORKER_FAILED' });
		expect(await client.api.meta.get().catch((e) => e)).toMatchObject({ code: 'WORKER_FAILED' });
		expect(fatal).toHaveLength(1);
	});

	it('fails every pending and later call once closed, without reporting a fatal error', async () => {
		const { endpoint } = silentEndpoint();
		const client = createRpcClient(endpoint);
		const fatal: RpcError[] = [];
		client.onFatal((e) => fatal.push(e));
		const pending = client.api.meta.get().catch((e) => e);
		const idle = client.idle();
		client.close();
		expect(await pending).toMatchObject({ code: 'WORKER_FAILED' });
		await expect(idle).resolves.toBeUndefined();
		expect(await client.api.meta.get().catch((e) => e)).toMatchObject({ code: 'WORKER_FAILED' });
		expect(fatal).toEqual([]);
	});
});

describe('idle', () => {
	it('resolves once every call in flight has its reply', async () => {
		const client = connect(await createBudgetDb());
		expect(await client.idle()).toBeUndefined();
		const events: string[] = [];
		void client.api.meta.get().then(() => events.push('reply'));
		await client.idle();
		events.push('idle');
		expect(events).toEqual(['reply', 'idle']);
	});

	it('resolves when the worker fails', async () => {
		const { endpoint, emit } = silentEndpoint();
		const client = createRpcClient(endpoint);
		void client.api.meta.get().catch(() => {});
		const idle = client.idle();
		emit('error');
		await expect(idle).resolves.toBeUndefined();
	});
});
