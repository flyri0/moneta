import { createRpcClient, type RpcClient } from './rpc';

/** Starts the SQLite worker. Call once per page (the worker owns the OPFS pool). */
export function startDbWorker(): RpcClient {
	const worker = new Worker(new URL('../db/worker.ts', import.meta.url), { type: 'module' });
	return createRpcClient(worker);
}
