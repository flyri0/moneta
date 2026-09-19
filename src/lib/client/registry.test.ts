import { describe, it, expect } from 'vitest';
import {
	isBudgetFile,
	loadRegistry,
	markOpened,
	newBudgetFile,
	pickBudget,
	reconcile,
	saveRegistry,
	upsertBudget,
	type KeyValueStore
} from './registry';
import { memoryStore } from './testing';

const A = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const B = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';
const C = 'budget-0190a000-0000-7000-8000-000000000003.sqlite3';

describe('budget files', () => {
	it('names new files so the worker accepts them', () => {
		const file = newBudgetFile();
		expect(file).toMatch(/^budget-[0-9a-f-]{36}\.sqlite3$/);
		expect(isBudgetFile(file)).toBe(true);
		expect(isBudgetFile('smoke.sqlite3')).toBe(false);
	});
});

describe('loadRegistry / saveRegistry', () => {
	it('round-trips through the store', () => {
		const store = memoryStore();
		saveRegistry(store, { budgets: [{ file: A, name: 'Home' }], lastOpened: A });
		expect(loadRegistry(store)).toEqual({ budgets: [{ file: A, name: 'Home' }], lastOpened: A });
	});

	it('tolerates a missing, corrupt or foreign value', () => {
		expect(loadRegistry(memoryStore())).toEqual({ budgets: [], lastOpened: null });
		expect(loadRegistry(memoryStore('{nope'))).toEqual({ budgets: [], lastOpened: null });
		expect(
			loadRegistry(memoryStore(JSON.stringify({ budgets: [{ file: 'x.db', name: 1 }] })))
		).toEqual({ budgets: [], lastOpened: null });
	});

	it('ignores a store that refuses writes', () => {
		const store: KeyValueStore = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			}
		};
		expect(() => saveRegistry(store, { budgets: [], lastOpened: null })).not.toThrow();
	});
});

describe('reconcile', () => {
	it('drops missing files, lists unknown budget files and ignores other files', () => {
		const registry = {
			budgets: [
				{ file: A, name: 'Home' },
				{ file: B, name: 'Gone' }
			],
			lastOpened: B
		};
		expect(reconcile(registry, [C, A, 'smoke.sqlite3'])).toEqual({
			registry: { budgets: [{ file: A, name: 'Home' }], lastOpened: null },
			unnamed: [C]
		});
	});
});

describe('pickBudget', () => {
	it('prefers the last opened budget, then the first one', () => {
		const budgets = [
			{ file: A, name: 'Home' },
			{ file: B, name: 'Work' }
		];
		expect(pickBudget({ budgets, lastOpened: B })).toBe(B);
		expect(pickBudget({ budgets, lastOpened: C })).toBe(A);
		expect(pickBudget({ budgets: [], lastOpened: null })).toBeNull();
	});
});

describe('upsertBudget / markOpened', () => {
	it('adds or renames entries and records the last opened file', () => {
		let registry = upsertBudget({ budgets: [], lastOpened: null }, { file: A, name: 'Home' });
		registry = upsertBudget(registry, { file: A, name: 'House' });
		registry = markOpened(upsertBudget(registry, { file: B, name: 'Work' }), B);
		expect(registry).toEqual({
			budgets: [
				{ file: A, name: 'House' },
				{ file: B, name: 'Work' }
			],
			lastOpened: B
		});
	});
});
