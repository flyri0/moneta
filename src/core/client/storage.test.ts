import { describe, expect, it } from 'vitest';
import { loadCollapsed, saveCollapsed } from '$features/budget/collapse';
import { endDemo, isDemoOpen, requestDemo } from './demo';
import { loadRegistry, saveRegistry } from './registry';
import { ensureLocalStorage, memoryStorage } from './storage';
import { brokenStore } from './testing';
import { dismissWelcome, shouldShowWelcome } from './welcome';

/** A window whose `localStorage` getter behaves like Chromium with site data blocked. */
function blockedWindow(): { localStorage: Storage } {
	return Object.defineProperty({} as { localStorage: Storage }, 'localStorage', {
		configurable: true,
		get() {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		}
	});
}

describe('memoryStorage', () => {
	it('behaves like Storage', () => {
		const storage = memoryStorage();
		storage.setItem('a', '1');
		storage.setItem('b', '2');
		storage.removeItem('b');
		expect(storage.getItem('a')).toBe('1');
		expect(storage.getItem('b')).toBeNull();
		expect(storage.length).toBe(1);
		expect(storage.key(0)).toBe('a');
		expect(storage.key(1)).toBeNull();
		storage.clear();
		expect(storage.length).toBe(0);
	});
});

describe('ensureLocalStorage', () => {
	it('keeps a working localStorage', () => {
		const real = memoryStorage();
		const win = { localStorage: real };
		expect(ensureLocalStorage(win)).toBe(false);
		expect(win.localStorage).toBe(real);
	});

	it('replaces a localStorage whose getter throws with one kept in memory', () => {
		const win = blockedWindow();
		expect(ensureLocalStorage(win)).toBe(true);
		win.localStorage.setItem('k', 'v');
		expect(win.localStorage.getItem('k')).toBe('v');
	});

	it('replaces a missing localStorage', () => {
		const win = { localStorage: null as unknown as Storage };
		expect(ensureLocalStorage(win)).toBe(true);
		expect(win.localStorage.getItem('k')).toBeNull();
	});
});

describe('the storage helpers', () => {
	it('treat a store that throws on every call as empty and read-only', () => {
		const store = brokenStore();
		const FILE = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
		expect(loadRegistry(store)).toEqual({ budgets: [], lastOpened: null });
		expect(shouldShowWelcome(store, false)).toBe(true);
		expect(isDemoOpen(store)).toBe(false);
		expect(loadCollapsed(store, FILE)).toEqual(new Set());
		expect(() => {
			saveRegistry(store, { budgets: [], lastOpened: null });
			dismissWelcome(store);
			requestDemo(store);
			endDemo(store);
			saveCollapsed(store, FILE, new Set(['x']));
		}).not.toThrow();
	});
});
