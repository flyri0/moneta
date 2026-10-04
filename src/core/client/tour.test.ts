import { describe, it, expect } from 'vitest';
import { noteBudgetOpened, planTour, settleTour, TOUR_KEY, tourPendingFor } from './tour';
import { brokenStore, memoryStore } from './testing';

const FIRST = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const SECOND = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';

describe('planTour', () => {
	it('plans the tour for the first budget made in this browser', () => {
		const store = memoryStore();
		planTour(store, FIRST);
		expect(tourPendingFor(store, FIRST)).toBe(true);
	});

	it('plans nothing once the tour was taken or skipped', () => {
		const store = memoryStore();
		settleTour(store);
		planTour(store, FIRST);
		expect(tourPendingFor(store, FIRST)).toBe(false);
	});

	it('keeps the first plan when another budget comes along', () => {
		const store = memoryStore();
		planTour(store, FIRST);
		planTour(store, SECOND);
		expect(tourPendingFor(store, FIRST)).toBe(true);
		expect(tourPendingFor(store, SECOND)).toBe(false);
	});
});

describe('noteBudgetOpened', () => {
	it('settles the tour when the first budget opened was not planned for it', () => {
		const store = memoryStore();
		noteBudgetOpened(store, false);
		expect(store.data.get(TOUR_KEY)).toBe('done');
		planTour(store, SECOND);
		expect(tourPendingFor(store, SECOND)).toBe(false);
	});

	it('leaves a planned tour alone', () => {
		const store = memoryStore();
		planTour(store, FIRST);
		noteBudgetOpened(store, false);
		expect(tourPendingFor(store, FIRST)).toBe(true);
	});

	it('ignores the demo', () => {
		const store = memoryStore();
		noteBudgetOpened(store, true);
		expect(store.data.has(TOUR_KEY)).toBe(false);
	});
});

describe('tourPendingFor', () => {
	it('is false on a fresh browser', () => {
		expect(tourPendingFor(memoryStore(), FIRST)).toBe(false);
	});

	it('ignores a value it does not know', () => {
		const store = memoryStore();
		store.setItem(TOUR_KEY, `pending:${FIRST}x`);
		expect(tourPendingFor(store, FIRST)).toBe(false);
		store.setItem(TOUR_KEY, 'whatever');
		expect(tourPendingFor(store, FIRST)).toBe(false);
	});
});

describe('settleTour', () => {
	it('ends a planned tour for good', () => {
		const store = memoryStore();
		planTour(store, FIRST);
		settleTour(store);
		expect(tourPendingFor(store, FIRST)).toBe(false);
	});
});

describe('blocked storage', () => {
	it('never throws', () => {
		const store = brokenStore();
		expect(() => planTour(store, FIRST)).not.toThrow();
		expect(() => noteBudgetOpened(store, false)).not.toThrow();
		expect(() => settleTour(store)).not.toThrow();
		expect(tourPendingFor(store, FIRST)).toBe(false);
	});
});
