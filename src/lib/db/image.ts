import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { Db } from './connection';

/** The bytes of a `.sqlite` file holding a copy of `db`. */
export function toImage(sqlite3: Sqlite3Static, db: Db): Uint8Array<ArrayBuffer> {
	return sqlite3.capi.sqlite3_js_db_export(db);
}

/** Opens an in-memory database holding a copy of a `.sqlite` file. The caller closes it. */
export function openImage(sqlite3: Sqlite3Static, bytes: Uint8Array): Db {
	const image = bytes.slice();
	// A WAL-mode file can't be read from memory. Mark it as rollback-journal, as the OPFS pool
	// does when it imports a file.
	if (image.length >= 20 && image[18] === 2 && image[19] === 2) image.set([1, 1], 18);
	const db = new sqlite3.oo1.DB(':memory:', 'c');
	const { capi, wasm } = sqlite3;
	const rc = capi.sqlite3_deserialize(
		db,
		'main',
		wasm.allocFromTypedArray(image),
		image.length,
		image.length,
		capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE
	);
	if (rc !== 0) {
		db.close();
		throw new Error(`sqlite3_deserialize failed (${rc})`);
	}
	return db;
}
