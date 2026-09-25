import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { Db } from './connection';

/** The bytes of a `.sqlite` file holding a copy of `db`. */
export function toImage(sqlite3: Sqlite3Static, db: Db): Uint8Array<ArrayBuffer> {
	return sqlite3.capi.sqlite3_js_db_export(db);
}

/** Loads a copy of a `.sqlite` file into `schema` of `db`, which must be an in-memory schema. */
function deserialize(sqlite3: Sqlite3Static, db: Db, schema: string, bytes: Uint8Array): void {
	const image = bytes.slice();
	// A WAL-mode file can't be read from memory. Mark it as rollback-journal, as the OPFS pool
	// does when it imports a file.
	if (image.length >= 20 && image[18] === 2 && image[19] === 2) image.set([1, 1], 18);
	const { capi, wasm } = sqlite3;
	const rc = capi.sqlite3_deserialize(
		db,
		schema,
		wasm.allocFromTypedArray(image),
		image.length,
		image.length,
		capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE
	);
	if (rc !== 0) throw new Error(`sqlite3_deserialize failed (${rc})`);
}

/** Opens an in-memory database holding a copy of a `.sqlite` file. The caller closes it. */
export function openImage(sqlite3: Sqlite3Static, bytes: Uint8Array): Db {
	const db = new sqlite3.oo1.DB(':memory:', 'c');
	try {
		deserialize(sqlite3, db, 'main', bytes);
	} catch (err) {
		db.close();
		throw err;
	}
	return db;
}

/** Attaches a copy of a `.sqlite` file to `db` as `schema`. */
export function attachImage(
	sqlite3: Sqlite3Static,
	db: Db,
	schema: string,
	bytes: Uint8Array
): void {
	db.exec(`ATTACH ':memory:' AS ${schema}`);
	deserialize(sqlite3, db, schema, bytes);
}
