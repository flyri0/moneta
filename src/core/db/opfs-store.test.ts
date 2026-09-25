import { describe, it, expect } from 'vitest';
import type { SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import { opfsStore } from './opfs-store';

/** Records what `importDb` receives, reading a chunk callback to its end as the pool does. */
function recordingPool() {
	const imports: { name: string; chunks: Uint8Array[]; chunked: boolean }[] = [];
	const pool = {
		async importDb(name: string, data: Uint8Array | (() => Promise<Uint8Array | undefined>)) {
			if (typeof data !== 'function') {
				imports.push({ name, chunks: [data], chunked: false });
				return data.byteLength;
			}
			const chunks: Uint8Array[] = [];
			for (let chunk = await data(); chunk !== undefined; chunk = await data()) chunks.push(chunk);
			imports.push({ name, chunks, chunked: true });
			return chunks.reduce((n, c) => n + c.byteLength, 0);
		}
	};
	return { pool: pool as unknown as SAHPoolUtil, imports };
}

describe('opfsStore', () => {
	it('writes a file through the chunked import, which truncates what was there', async () => {
		const { pool, imports } = recordingPool();
		const bytes = new Uint8Array(1024).fill(7);
		await opfsStore(pool).write('budget-1.sqlite3', bytes);
		expect(imports).toEqual([{ name: '/budget-1.sqlite3', chunks: [bytes], chunked: true }]);
	});
});
