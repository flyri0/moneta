import { describe, it, expect } from 'vitest';
import { reportsLayoutKey } from '$client/registry';
import { memoryStore } from '$client/testing';
import {
	DEFAULT_LAYOUT,
	REPORT_IDS,
	dropCard,
	hiddenCards,
	loadLayout,
	moveCard,
	normalizeLayout,
	saveLayout,
	toggleHidden,
	visibleCards,
	type ReportsLayout
} from './layout';

const A = 'budget-0190a000-0000-7000-8000-000000000001.sqlite3';
const B = 'budget-0190a000-0000-7000-8000-000000000002.sqlite3';

describe('normalizeLayout', () => {
	it('lists every report once, in the default order, with none hidden', () => {
		expect(DEFAULT_LAYOUT.order).toEqual([...REPORT_IDS]);
		expect(DEFAULT_LAYOUT.hidden).toEqual([]);
		expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
	});

	it('keeps a saved order and appends reports it does not know about, shown', () => {
		const saved = { order: ['accounts', 'spending'], hidden: ['spending'] };
		const layout = normalizeLayout(saved);
		expect(layout.order.slice(0, 2)).toEqual(['accounts', 'spending']);
		expect(new Set(layout.order)).toEqual(new Set(REPORT_IDS));
		expect(layout.order).toHaveLength(REPORT_IDS.length);
		expect(layout.hidden).toEqual(['spending']);
	});

	it('drops unknown, repeated and non-string ids', () => {
		const layout = normalizeLayout({
			order: ['payees', 'gone', 'payees', 7, 'spending'],
			hidden: ['gone', 'payees', 'payees', null]
		});
		expect(layout.order.slice(0, 2)).toEqual(['payees', 'spending']);
		expect(layout.order).toHaveLength(REPORT_IDS.length);
		expect(layout.hidden).toEqual(['payees']);
	});

	it('falls back to the default for anything that is not a layout', () => {
		expect(normalizeLayout('oops')).toEqual(DEFAULT_LAYOUT);
		expect(normalizeLayout({ order: 'spending' })).toEqual(DEFAULT_LAYOUT);
	});
});

describe('stored layout', () => {
	it('round-trips, keeping each budget file separate', () => {
		const store = memoryStore();
		const a: ReportsLayout = { order: [...REPORT_IDS].reverse(), hidden: ['payees'] };
		saveLayout(store, A, a);
		saveLayout(store, B, DEFAULT_LAYOUT);
		expect(loadLayout(store, A)).toEqual(a);
		expect(loadLayout(store, B)).toEqual(DEFAULT_LAYOUT);
		expect(store.data.has(reportsLayoutKey(A))).toBe(true);
	});

	it('reads the default when the value is missing or malformed', () => {
		const store = memoryStore();
		expect(loadLayout(store, A)).toEqual(DEFAULT_LAYOUT);
		store.data.set(reportsLayoutKey(A), '{oops');
		expect(loadLayout(store, A)).toEqual(DEFAULT_LAYOUT);
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
		expect(loadLayout(blocked, A)).toEqual(DEFAULT_LAYOUT);
		expect(() => saveLayout(blocked, A, DEFAULT_LAYOUT)).not.toThrow();
	});
});

describe('editing the layout', () => {
	const layout: ReportsLayout = {
		order: ['spending', 'net-worth', 'payees', 'accounts'] as ReportsLayout['order'],
		hidden: []
	};

	it('drops a card at an index, clamped', () => {
		expect(dropCard(layout, 'accounts', 0).order).toEqual([
			'accounts',
			'spending',
			'net-worth',
			'payees'
		]);
		expect(dropCard(layout, 'spending', 99).order).toEqual([
			'net-worth',
			'payees',
			'accounts',
			'spending'
		]);
		expect(dropCard(layout, 'spending', 0)).toBe(layout);
	});

	it('moves a card one step, and not past either end', () => {
		expect(moveCard(layout, 'payees', -1).order).toEqual([
			'spending',
			'payees',
			'net-worth',
			'accounts'
		]);
		expect(moveCard(layout, 'spending', -1)).toBe(layout);
		expect(moveCard(layout, 'accounts', 1)).toBe(layout);
	});

	it('hides a card and shows it again', () => {
		const hidden = toggleHidden(layout, 'payees');
		expect(hidden.hidden).toEqual(['payees']);
		expect(visibleCards(hidden)).toEqual(['spending', 'net-worth', 'accounts']);
		expect(hiddenCards(hidden)).toEqual(['payees']);
		expect(toggleHidden(hidden, 'payees').hidden).toEqual([]);
	});

	it('lists hidden cards in the saved order', () => {
		const both = toggleHidden(toggleHidden(layout, 'accounts'), 'spending');
		expect(hiddenCards(both)).toEqual(['spending', 'accounts']);
	});
});
