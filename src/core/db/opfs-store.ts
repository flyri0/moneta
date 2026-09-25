import type { SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import type { FileStore } from './system';

/** Budget files in the OPFS SAH pool. Pool paths start with a slash; file names don't. */
export function opfsStore(pool: SAHPoolUtil): FileStore {
	return {
		list: () => pool.getFileNames().map((n) => n.replace(/^\//, '')),
		open: (name) => new pool.OpfsSAHPoolDb(`/${name}`),
		close: (db) => db.close(),
		async write(name, bytes) {
			// Given bytes, importDb writes over an existing file without truncating it, so a smaller
			// budget would leave the old one's last pages behind. Given a function, it truncates first.
			let chunk: Uint8Array | undefined = bytes;
			await pool.importDb(`/${name}`, async () => {
				const next = chunk;
				chunk = undefined;
				return next;
			});
		},
		remove(name) {
			pool.unlink(`/${name}`);
		},
		async reserve(count) {
			// The pool only grows on request, and it starts with room for 12 files.
			await pool.reserveMinimumCapacity(pool.getFileCount() + count);
		},
		release() {
			if (!pool.isPaused()) pool.pauseVfs();
		}
	};
}
