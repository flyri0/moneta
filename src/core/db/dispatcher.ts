import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import { ALL_TABLES, tx, type Db, type Table } from './connection';
import { findHandler, type SystemApi } from './api';
import { checkArgs, type ArgSpec } from './args';
import type { CallRequest, CallResponse, RpcErrorPayload } from './protocol';
import { applyInverse, record } from './undo';

export interface DispatcherDeps {
	system: SystemApi;
	getDb: () => Db | null;
	/** The SQLite module, for undo. Without it, undoable writes return no undo token. */
	sqlite3?: Sqlite3Static;
}

/** The latest undoable write: what takes it back, on which database. */
interface UndoEntry {
	token: string;
	db: Db;
	inverse: Uint8Array;
	tables: readonly Table[];
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
	wipe: ALL_TABLES,
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
	wipe: [],
	listCopies: ['string'],
	readCopy: ['string'],
	exportBackup: ['array', 'object?'],
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

/**
 * Turns a CallRequest into a CallResponse. Never throws. Only the latest undoable write can be
 * taken back (`undo.apply` with the token its response carried).
 */
export function createDispatcher(deps: DispatcherDeps) {
	let lastUndo: UndoEntry | null = null;
	let nextToken = 1;

	return async function dispatch(req: CallRequest): Promise<CallResponse> {
		try {
			const [ns, name] = req.method.split('.');
			if (ns === 'undo' && name === 'apply') {
				checkArgs(req.method, ['string'], req.args);
				const entry = lastUndo;
				const sqlite3 = deps.sqlite3;
				if (!entry || !sqlite3 || entry.token !== req.args[0] || entry.db !== deps.getDb())
					throw new DomainError('UNDO_UNAVAILABLE');
				const { db, inverse } = entry;
				tx(db, () => {
					applyInverse(sqlite3, db, inverse);
					// An account only closes at a zero balance: taking back a write must not undo that.
					if (
						db.selectValue(
							`SELECT 1 FROM accounts a WHERE a.closed = 1
								AND (SELECT TOTAL(t.amount) FROM transactions t WHERE t.account_id = a.id) <> 0`
						)
					)
						throw new DomainError('UNDO_CONFLICT');
				});
				lastUndo = null;
				return { id: req.id, ok: true, data: null, changed: [...entry.tables] };
			}
			if (ns === 'system') {
				if (!Object.hasOwn(SYSTEM_CHANGES, name))
					throw new DomainError('UNKNOWN_METHOD', req.method);
				const key = name as keyof SystemApi;
				checkArgs(req.method, SYSTEM_ARGS[key], req.args);
				const fn = deps.system[key] as (...args: unknown[]) => unknown;
				const data = await fn(...req.args);
				// Opening, closing or replacing a budget leaves nothing to take back.
				if (SYSTEM_CHANGES[key] === ALL_TABLES) lastUndo = null;
				return { id: req.id, ok: true, data: data ?? null, changed: [...SYSTEM_CHANGES[key]] };
			}
			const handler = findHandler(req.method);
			if (!handler) throw new DomainError('UNKNOWN_METHOD', req.method);
			checkArgs(req.method, handler.args, req.args);
			const db = deps.getDb();
			if (!db) throw new DomainError('NO_DATABASE_OPEN');
			const changed = [...handler.tables];
			if (handler.kind === 'read')
				return { id: req.id, ok: true, data: handler.fn(db, ...req.args) ?? null, changed };
			const sqlite3 = deps.sqlite3;
			if (!handler.undoable || !sqlite3) {
				const data = tx(db, () => handler.fn(db, ...req.args));
				return { id: req.id, ok: true, data: data ?? null, changed };
			}
			const { result, inverse } = tx(db, () =>
				record(sqlite3, db, () => handler.fn(db, ...req.args))
			);
			const token = String(nextToken++);
			lastUndo = { token, db, inverse, tables: handler.tables };
			return { id: req.id, ok: true, data: result ?? null, changed, undo: token };
		} catch (err) {
			return { id: req.id, ok: false, error: toPayload(err) };
		}
	};
}
