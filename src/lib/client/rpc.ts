import type { Table } from '$lib/db/connection';
import type { ClientApi } from '$lib/db/api';
import type { CallRequest, CallResponse } from '$lib/db/protocol';

/** Anything that can exchange messages with the DB worker (a Worker or a MessagePort). */
export interface Endpoint {
	postMessage(message: unknown): void;
	addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
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

export interface RpcClient {
	api: ClientApi;
	onChange(listener: ChangeListener): () => void;
}

export function createRpcClient(endpoint: Endpoint): RpcClient {
	let nextId = 1;
	const pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: unknown) => void }
	>();
	const listeners = new Set<ChangeListener>();

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
	});
	endpoint.start?.();

	function call(method: string, args: unknown[]): Promise<unknown> {
		const id = nextId++;
		return new Promise((resolve, reject) => {
			pending.set(id, { resolve, reject });
			const req: CallRequest = { id, method, args };
			endpoint.postMessage(req);
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
		}
	};
}
