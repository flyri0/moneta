import { describe, it, expect } from 'vitest';
import { transferablesOf } from './protocol';

describe('transferablesOf', () => {
	it('hands over the buffer of bytes a call returns, alone or as `bytes`', () => {
		const bytes = new Uint8Array(8);
		expect(transferablesOf({ id: 1, ok: true, data: bytes, changed: [] })).toEqual([bytes.buffer]);
		expect(transferablesOf({ id: 1, ok: true, data: { bytes, skipped: [] }, changed: [] })).toEqual(
			[bytes.buffer]
		);
	});

	it('keeps views into a larger buffer (such as WebAssembly memory), other data and errors', () => {
		const view = new Uint8Array(64).subarray(8, 16);
		expect(transferablesOf({ id: 1, ok: true, data: view, changed: [] })).toEqual([]);
		expect(transferablesOf({ id: 1, ok: true, data: [1, 2], changed: [] })).toEqual([]);
		expect(transferablesOf({ id: 1, ok: true, data: null, changed: [] })).toEqual([]);
		expect(
			transferablesOf({ id: 1, ok: false, error: { code: 'INTERNAL', message: 'x' } })
		).toEqual([]);
	});
});
