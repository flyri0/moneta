import { describe, it, expect } from 'vitest';
import { HIDE_AMOUNTS_KEY, readHideAmounts, writeHideAmounts } from './hide-amounts';
import { memoryStore } from './testing';

describe('readHideAmounts', () => {
	it('shows amounts by default', () => {
		expect(readHideAmounts(memoryStore())).toBe(false);
	});

	it('reads what was written', () => {
		const store = memoryStore();
		writeHideAmounts(store, true);
		expect(store.getItem(HIDE_AMOUNTS_KEY)).toBe('1');
		expect(readHideAmounts(store)).toBe(true);
		writeHideAmounts(store, false);
		expect(readHideAmounts(store)).toBe(false);
	});

	it('shows amounts when storage is blocked', () => {
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {}
		};
		expect(() => writeHideAmounts(blocked, true)).not.toThrow();
		expect(readHideAmounts(blocked)).toBe(false);
	});
});
