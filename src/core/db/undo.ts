import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DomainError } from '$domain/errors';
import type { Db } from './connection';

/**
 * Runs `fn` while SQLite's session extension records what it changes, and returns its result with
 * the changeset that takes it back. Run it inside the write's transaction: a change rolled back
 * inside `fn` leaves nothing behind, since the changeset compares against the rows as they end up.
 */
export function record<T>(
	sqlite3: Sqlite3Static,
	db: Db,
	fn: () => T
): { result: T; inverse: Uint8Array } {
	const { capi, wasm } = sqlite3;
	const stack = wasm.pstack.pointer;
	let session = 0;
	try {
		const ppSession = wasm.pstack.allocPtr();
		check(sqlite3, capi.sqlite3session_create(db, 'main', ppSession));
		session = wasm.peekPtr(ppSession) as number;
		check(sqlite3, capi.sqlite3session_attach(session, null));
		const result = fn();
		const [pn, pp] = wasm.pstack.allocPtr(2);
		check(sqlite3, capi.sqlite3session_changeset(session, pn, pp));
		const changeset = takeBytes(sqlite3, pn, pp);
		return { result, inverse: invert(sqlite3, changeset) };
	} finally {
		if (session) capi.sqlite3session_delete(session);
		wasm.pstack.restore(stack);
	}
}

/**
 * Applies a changeset from `record`, taking its write back. Any conflict (a row changed or deleted
 * since, a row it restores pointing at something gone) aborts it with nothing applied.
 */
export function applyInverse(sqlite3: Sqlite3Static, db: Db, inverse: Uint8Array): void {
	const { capi, wasm } = sqlite3;
	if (inverse.length === 0) return;
	const bytes = wasm.allocFromTypedArray(inverse);
	try {
		const rc = capi.sqlite3changeset_apply(
			db,
			inverse.length,
			bytes,
			0,
			() => capi.SQLITE_CHANGESET_ABORT,
			0
		);
		// Inside a transaction, a broken foreign key shows up at the end, as a constraint error.
		const primary = rc & 0xff;
		if (primary === capi.SQLITE_ABORT || primary === capi.SQLITE_CONSTRAINT)
			throw new DomainError('UNDO_CONFLICT');
		check(sqlite3, rc);
	} finally {
		wasm.dealloc(bytes);
	}
}

/** How many row changes a changeset holds. */
export function changesetSize(sqlite3: Sqlite3Static, changeset: Uint8Array): number {
	const { capi, wasm } = sqlite3;
	if (changeset.length === 0) return 0;
	const stack = wasm.pstack.pointer;
	const bytes = wasm.allocFromTypedArray(changeset);
	let iter = 0;
	try {
		const pp = wasm.pstack.allocPtr();
		check(sqlite3, capi.sqlite3changeset_start(pp, changeset.length, bytes));
		iter = wasm.peekPtr(pp) as number;
		let size = 0;
		while (capi.sqlite3changeset_next(iter) === capi.SQLITE_ROW) size++;
		return size;
	} finally {
		if (iter) capi.sqlite3changeset_finalize(iter);
		wasm.dealloc(bytes);
		wasm.pstack.restore(stack);
	}
}

function invert(sqlite3: Sqlite3Static, changeset: Uint8Array): Uint8Array {
	const { capi, wasm } = sqlite3;
	if (changeset.length === 0) return changeset;
	const bytes = wasm.allocFromTypedArray(changeset);
	try {
		const [pn, pp] = wasm.pstack.allocPtr(2);
		check(sqlite3, capi.sqlite3changeset_invert(changeset.length, bytes, pn, pp));
		return takeBytes(sqlite3, pn, pp);
	} finally {
		wasm.dealloc(bytes);
	}
}

/** Copies out the buffer SQLite allocated at `*pp` (`*pn` bytes long), then frees it. */
function takeBytes(sqlite3: Sqlite3Static, pn: number, pp: number): Uint8Array {
	const { capi, wasm } = sqlite3;
	const size = wasm.peek32(pn) as number;
	const ptr = wasm.peekPtr(pp) as number;
	try {
		return wasm.heap8u().slice(ptr, ptr + size);
	} finally {
		if (ptr) capi.sqlite3_free(ptr);
	}
}

function check(sqlite3: Sqlite3Static, rc: number): void {
	if (rc !== sqlite3.capi.SQLITE_OK)
		throw new Error(`SQLite session error: ${sqlite3.capi.sqlite3_js_rc_str(rc) ?? rc}`);
}
