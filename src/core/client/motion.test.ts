import { describe, it, expect } from 'vitest';
import { MOTION_KEY, isReduced, readMotion, writeMotion } from './motion';
import { memoryStore } from './testing';

describe('readMotion', () => {
	it('follows the system until something else is stored', () => {
		const store = memoryStore();
		expect(readMotion(store)).toBe('system');
		store.setItem(MOTION_KEY, 'reduce');
		expect(readMotion(store)).toBe('reduce');
		store.setItem(MOTION_KEY, 'garbage');
		expect(readMotion(store)).toBe('system');
	});

	it('follows the system when storage is blocked', () => {
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {}
		};
		expect(readMotion(blocked)).toBe('system');
		expect(() => writeMotion(blocked, 'reduce')).not.toThrow();
	});
});

describe('writeMotion', () => {
	it('stores a reduced choice and forgets the default', () => {
		const store = memoryStore();
		writeMotion(store, 'reduce');
		expect(store.data.get(MOTION_KEY)).toBe('reduce');
		writeMotion(store, 'system');
		expect(store.data.has(MOTION_KEY)).toBe(false);
	});
});

describe('isReduced', () => {
	it('reduces when asked here or by the system, never animating against the system', () => {
		expect(isReduced('system', false)).toBe(false);
		expect(isReduced('system', true)).toBe(true);
		expect(isReduced('reduce', false)).toBe(true);
		expect(isReduced('reduce', true)).toBe(true);
	});
});
