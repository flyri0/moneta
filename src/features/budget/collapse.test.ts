import { describe, it, expect } from 'vitest';
import { collapsedKey } from '$client/registry';
import { memoryStore } from '$client/testing';
import { allCollapsed, loadCollapsed, saveCollapsed, toggleAll, toggleCollapsed } from './collapse';

const A = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const B = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';
const groups = [{ id: 'bills' }, { id: 'fun' }, { id: 'cards' }];

describe('stored collapsed groups', () => {
	it('round-trips a set, keeping each budget file separate', () => {
		const store = memoryStore();
		saveCollapsed(store, A, new Set(['bills', 'fun']));
		saveCollapsed(store, B, new Set(['cards']));
		expect([...loadCollapsed(store, A)]).toEqual(['bills', 'fun']);
		expect([...loadCollapsed(store, B)]).toEqual(['cards']);
		expect(store.data.has(collapsedKey(A))).toBe(true);
	});

	it('reads nothing collapsed when the value is missing, malformed or not an array', () => {
		const store = memoryStore();
		expect(loadCollapsed(store, A).size).toBe(0);
		store.data.set(collapsedKey(A), '{oops');
		expect(loadCollapsed(store, A).size).toBe(0);
		store.data.set(collapsedKey(A), '{"bills":true}');
		expect(loadCollapsed(store, A).size).toBe(0);
	});

	it('drops entries that are not strings', () => {
		const store = memoryStore();
		store.data.set(collapsedKey(A), '["bills",7,null,"fun"]');
		expect([...loadCollapsed(store, A)]).toEqual(['bills', 'fun']);
	});

	it('survives a store that throws', () => {
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {}
		};
		expect(() => saveCollapsed(blocked, A, new Set(['bills']))).not.toThrow();
		expect(loadCollapsed(blocked, A).size).toBe(0);
	});
});

describe('toggleCollapsed', () => {
	it('adds then removes an id without mutating the set it was given', () => {
		const none = new Set<string>();
		const one = toggleCollapsed(none, 'bills');
		expect([...one]).toEqual(['bills']);
		expect(none.size).toBe(0);
		expect([...toggleCollapsed(one, 'bills')]).toEqual([]);
		expect([...one]).toEqual(['bills']);
	});
});

describe('allCollapsed', () => {
	it('is false for an empty grid and for a partly collapsed one', () => {
		expect(allCollapsed([], new Set())).toBe(false);
		expect(allCollapsed(groups, new Set(['bills']))).toBe(false);
	});

	it('is true once every group is collapsed', () => {
		expect(allCollapsed(groups, new Set(['bills', 'fun', 'cards']))).toBe(true);
	});
});

describe('toggleAll', () => {
	it('collapses every group from a partly collapsed state', () => {
		expect([...toggleAll(groups, new Set(['bills']))]).toEqual(['bills', 'fun', 'cards']);
	});

	it('expands everything when all groups are collapsed', () => {
		expect([...toggleAll(groups, new Set(['bills', 'fun', 'cards']))]).toEqual([]);
	});

	it('forgets groups that no longer exist when collapsing', () => {
		expect([...toggleAll([{ id: 'bills' }], new Set(['gone']))]).toEqual(['bills']);
	});
});
