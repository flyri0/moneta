import type { Table } from '$db/connection';
import type { ClientApi } from '$db/api';
import type { CallRequest, CallResponse } from '$db/protocol';
import { toTransferable } from './transferable.svelte';

/** Anything that can exchange messages with the DB worker (a Worker or a MessagePort). */
export interface Endpoint {
	postMessage(message: unknown): void;
	addEventListener(
		type: 'message' | 'messageerror' | 'error',
		listener: (event: MessageEvent) => void
	): void;
	start?(): void;
}

export class RpcError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'RpcError';
	}
}

export type ChangeListener = (tables: Table[]) => void;
export type FatalListener = (error: RpcError) => void;

export interface RpcClient {
	api: ClientApi;
	onChange(listener: ChangeListener): () => void;
	/** Called once if the worker dies or a reply cannot be read. Every later call rejects. */
	onFatal(listener: FatalListener): () => void;
	/** Resolves once no call is waiting for its reply. */
	idle(): Promise<void>;
}

export function createRpcClient(endpoint: Endpoint): RpcClient {
	let nextId = 1;
	let fatal: RpcError | null = null;
	const pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: unknown) => void }
	>();
	const listeners = new Set<ChangeListener>();
	const fatalListeners = new Set<FatalListener>();
	const idleWaiters: (() => void)[] = [];

	function settle(): void {
		if (pending.size === 0) for (const resolve of idleWaiters.splice(0)) resolve();
	}

	function fail(message: string): void {
		if (fatal) return;
		fatal = new RpcError('WORKER_FAILED', message);
		for (const entry of pending.values()) entry.reject(fatal);
		pending.clear();
		settle();
		for (const l of fatalListeners) l(fatal);
	}

	endpoint.addEventListener('message', (event: MessageEvent) => {
		const res = event.data as CallResponse;
		const entry = pending.get(res.id);
		if (!entry) return;
		pending.delete(res.id);
		if (res.ok) {
			entry.resolve(res.data);
			if (res.changed.length > 0) for (const l of listeners) l(res.changed);
		} else {
			entry.reject(new RpcError(res.error.code, res.error.message, res.error.details));
		}
		settle();
	});
	endpoint.addEventListener('error', (event) => {
		const message = (event as { message?: unknown }).message;
		fail(typeof message === 'string' && message ? message : 'The database worker stopped');
	});
	endpoint.addEventListener('messageerror', () => fail('A database reply could not be read'));
	endpoint.start?.();

	function call(method: string, args: unknown[]): Promise<unknown> {
		if (fatal) return Promise.reject(fatal);
		const id = nextId++;
		return new Promise((resolve, reject) => {
			const req: CallRequest = { id, method, args: toTransferable(args) };
			try {
				endpoint.postMessage(req);
			} catch (err) {
				// e.g. a DataCloneError: the arguments hold something that cannot be sent.
				reject(new RpcError('INTERNAL', err instanceof Error ? err.message : String(err)));
				return;
			}
			pending.set(id, { resolve, reject });
		});
	}

	const api = new Proxy({} as ClientApi, {
		get(_, ns) {
			if (typeof ns !== 'string' || ns === 'then') return undefined;
			return new Proxy(
				{},
				{
					get(_, name) {
						if (typeof name !== 'string' || name === 'then') return undefined;
						return (...args: unknown[]) => call(`${ns}.${name}`, args);
					}
				}
			);
		}
	});

	return {
		api,
		onChange(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onFatal(listener) {
			fatalListeners.add(listener);
			return () => fatalListeners.delete(listener);
		},
		idle() {
			return pending.size === 0
				? Promise.resolve()
				: new Promise<void>((resolve) => idleWaiters.push(resolve));
		}
	};
}
