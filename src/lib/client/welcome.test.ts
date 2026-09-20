import { describe, it, expect } from 'vitest';
import { dismissWelcome, shouldShowWelcome, WELCOME_KEY } from './welcome';
import { memoryStore } from './testing';

const FILE = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const WITH_BUDGET = JSON.stringify({
	budgets: [{ file: FILE, name: 'Home' }],
	lastOpened: FILE
});

describe('shouldShowWelcome', () => {
	it('shows on a fresh browser tab', () => {
		expect(shouldShowWelcome(memoryStore(), false)).toBe(true);
	});

	it('stays out of the way of an installed window', () => {
		expect(shouldShowWelcome(memoryStore(), true)).toBe(false);
	});

	it('stays out of the way once a budget exists', () => {
		expect(shouldShowWelcome(memoryStore(WITH_BUDGET), false)).toBe(false);
	});

	it('treats an empty registry as a fresh browser', () => {
		const store = memoryStore(JSON.stringify({ budgets: [], lastOpened: null }));
		expect(shouldShowWelcome(store, false)).toBe(true);
	});

	it('does not come back after it was dismissed', () => {
		const store = memoryStore();
		dismissWelcome(store);
		expect(shouldShowWelcome(store, false)).toBe(false);
	});

	it('ignores an unrelated value under the dismissal key', () => {
		const store = memoryStore();
		store.setItem(WELCOME_KEY, 'maybe');
		expect(shouldShowWelcome(store, false)).toBe(true);
	});
});

describe('dismissWelcome', () => {
	it('writes the flag under its own key', () => {
		const store = memoryStore();
		dismissWelcome(store);
		expect(store.data.get(WELCOME_KEY)).toBe('done');
	});

	it('survives a store that refuses writes', () => {
		const store = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {}
		};
		expect(() => dismissWelcome(store)).not.toThrow();
	});
});
