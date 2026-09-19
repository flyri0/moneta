import { createRpcClient, type RpcClient } from './rpc';

export interface DbWorker extends RpcClient {
	/** Stops the worker. Call `api.system.release()` first so OPFS handles are let go cleanly. */
	terminate(): void;
}

/** Starts the SQLite worker. Only the tab that holds the tab lock may call this. */
export function startDbWorker(): DbWorker {
	const worker = new Worker(new URL('../db/worker.ts', import.meta.url), { type: 'module' });
	return { ...createRpcClient(worker), terminate: () => worker.terminate() };
}
