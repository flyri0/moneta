import { DomainError } from '$domain/errors';
import { ALL_TABLES, tx, type Db } from './connection';
import { findHandler, type SystemApi } from './api';
import { checkArgs, type ArgSpec } from './args';
import type { CallRequest, CallResponse, RpcErrorPayload } from './protocol';

export interface DispatcherDeps {
	system: SystemApi;
	getDb: () => Db | null;
}

function toPayload(err: unknown): RpcErrorPayload {
	if (err instanceof DomainError)
		return { code: err.code, message: err.message, details: err.details };
	const message = err instanceof Error ? err.message : String(err);
	return { code: 'INTERNAL', message };
}

const SYSTEM_CHANGES = {
	open: ALL_TABLES,
	close: ALL_TABLES,
	listFiles: [],
	deleteFile: [],
	release: [],
	listCopies: [],
	readCopy: [],
	exportBackup: [],
	markBackedUp: ['meta'],
	inspectBackup: [],
	restoreBackup: ALL_TABLES,
	restoreInspected: ALL_TABLES,
	backupEncryption: [],
	setBackupEncryption: [],
	clearBackupEncryption: [],
	checkBackupPassword: [],
	isEncryptedBackup: [],
	unlockBackup: []
} as const;

const SYSTEM_ARGS: { [K in keyof SystemApi]: ArgSpec<Parameters<SystemApi[K]>> } = {
	open: ['string'],
	close: [],
	listFiles: [],
	deleteFile: ['string'],
	release: [],
	listCopies: ['string'],
	readCopy: ['string'],
	exportBackup: ['array'],
	markBackedUp: ['array', 'string'],
	inspectBackup: ['bytes'],
	restoreBackup: ['bytes', 'array'],
	restoreInspected: ['string', 'array'],
	backupEncryption: [],
	setBackupEncryption: ['string', 'string'],
	clearBackupEncryption: [],
	checkBackupPassword: ['string'],
	isEncryptedBackup: ['bytes'],
	unlockBackup: ['bytes', 'object']
};

/** Turns a CallRequest into a CallResponse. Never throws. */
export function createDispatcher(deps: DispatcherDeps) {
	return async function dispatch(req: CallRequest): Promise<CallResponse> {
		try {
			const [ns, name] = req.method.split('.');
			if (ns === 'system') {
				if (!Object.hasOwn(SYSTEM_CHANGES, name))
					throw new DomainError('UNKNOWN_METHOD', req.method);
				const key = name as keyof SystemApi;
				checkArgs(req.method, SYSTEM_ARGS[key], req.args);
				const fn = deps.system[key] as (...args: unknown[]) => unknown;
				const data = await fn(...req.args);
				return { id: req.id, ok: true, data: data ?? null, changed: [...SYSTEM_CHANGES[key]] };
			}
			const handler = findHandler(req.method);
			if (!handler) throw new DomainError('UNKNOWN_METHOD', req.method);
			checkArgs(req.method, handler.args, req.args);
			const db = deps.getDb();
			if (!db) throw new DomainError('NO_DATABASE_OPEN');
			const data =
				handler.kind === 'write'
					? tx(db, () => handler.fn(db, ...req.args))
					: handler.fn(db, ...req.args);
			return { id: req.id, ok: true, data: data ?? null, changed: [...handler.tables] };
		} catch (err) {
			return { id: req.id, ok: false, error: toPayload(err) };
		}
	};
}
