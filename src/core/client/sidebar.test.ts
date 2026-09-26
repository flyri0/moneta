import { describe, it, expect } from 'vitest';
import {
	DEFAULT_SIDEBAR,
	MIN_WIDTH,
	RAIL_WIDTH,
	SIDEBAR_KEY,
	clampWidth,
	dragTo,
	maxWidth,
	readSidebar,
	stepBy,
	writeSidebar
} from './sidebar';
import { memoryStore } from './testing';

describe('maxWidth', () => {
	it('is a quarter of the viewport', () => {
		expect(maxWidth(1920)).toBe(480);
	});

	it('never goes below the narrowest expanded sidebar', () => {
		expect(maxWidth(800)).toBe(MIN_WIDTH);
	});
});

describe('clampWidth', () => {
	it('keeps a width between the minimum and a quarter of the viewport', () => {
		expect(clampWidth(300, 1920)).toBe(300);
		expect(clampWidth(100, 1920)).toBe(MIN_WIDTH);
		expect(clampWidth(900, 1920)).toBe(480);
	});

	it('rounds to whole pixels', () => {
		expect(clampWidth(300.6, 1920)).toBe(301);
	});
});

describe('dragTo', () => {
	it('follows the pointer within the limits', () => {
		expect(dragTo(320, 1920, DEFAULT_SIDEBAR)).toEqual({ width: 320, collapsed: false });
		expect(dragTo(1000, 1920, DEFAULT_SIDEBAR)).toEqual({ width: 480, collapsed: false });
	});

	it('stops at the minimum just below it', () => {
		expect(dragTo(MIN_WIDTH - 20, 1920, DEFAULT_SIDEBAR)).toEqual({
			width: MIN_WIDTH,
			collapsed: false
		});
	});

	it('snaps to the rail past halfway to it, keeping the width to come back to', () => {
		const snapped = dragTo((RAIL_WIDTH + MIN_WIDTH) / 2 - 1, 1920, {
			width: 300,
			collapsed: false
		});
		expect(snapped).toEqual({ width: 300, collapsed: true });
	});

	it('expands a rail dragged back out', () => {
		expect(dragTo(260, 1920, { width: 300, collapsed: true })).toEqual({
			width: 260,
			collapsed: false
		});
	});
});

describe('stepBy', () => {
	it('widens and narrows by the step', () => {
		expect(stepBy({ width: 300, collapsed: false }, 16, 1920)).toEqual({
			width: 316,
			collapsed: false
		});
		expect(stepBy({ width: 300, collapsed: false }, -16, 1920)).toEqual({
			width: 284,
			collapsed: false
		});
	});

	it('collapses when narrowing past the minimum', () => {
		expect(stepBy({ width: MIN_WIDTH, collapsed: false }, -16, 1920)).toEqual({
			width: MIN_WIDTH,
			collapsed: true
		});
	});

	it('expands a rail to its saved width', () => {
		expect(stepBy({ width: 300, collapsed: true }, 16, 1920)).toEqual({
			width: 300,
			collapsed: false
		});
	});

	it('steps from the width shown when the saved one no longer fits', () => {
		expect(stepBy({ width: 480, collapsed: false }, -16, 1024)).toEqual({
			width: 240,
			collapsed: false
		});
	});

	it('leaves a rail alone when narrowing', () => {
		const rail = { width: 300, collapsed: true };
		expect(stepBy(rail, -16, 1920)).toEqual(rail);
	});
});

describe('readSidebar', () => {
	it('starts at the default', () => {
		expect(readSidebar(memoryStore())).toEqual(DEFAULT_SIDEBAR);
	});

	it('reads back what was written', () => {
		const store = memoryStore();
		writeSidebar(store, { width: 333, collapsed: true });
		expect(readSidebar(store)).toEqual({ width: 333, collapsed: true });
	});

	it('falls back to the default on anything else', () => {
		for (const raw of ['nope', '{"width":"wide","collapsed":false}', '{"width":300}', 'null']) {
			const store = memoryStore();
			store.setItem(SIDEBAR_KEY, raw);
			expect(readSidebar(store), raw).toEqual(DEFAULT_SIDEBAR);
		}
	});

	it('survives blocked storage', () => {
		const store = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('SecurityError');
			},
			removeItem: () => {}
		};
		expect(readSidebar(store)).toEqual(DEFAULT_SIDEBAR);
		expect(() => writeSidebar(store, DEFAULT_SIDEBAR)).not.toThrow();
	});
});
