import { describe, it, expect } from 'vitest';
import { edgeScrollSpeed, shouldMove } from './sortable';

describe('edgeScrollSpeed', () => {
	it('is zero away from the edges', () => {
		expect(edgeScrollSpeed(300, 0, 600)).toBe(0);
		expect(edgeScrollSpeed(72, 0, 600)).toBe(0);
		expect(edgeScrollSpeed(528, 0, 600)).toBe(0);
	});

	it('scrolls up near the top and down near the bottom, faster closer to the edge', () => {
		expect(edgeScrollSpeed(36, 0, 600)).toBeCloseTo(-9);
		expect(edgeScrollSpeed(0, 0, 600)).toBeCloseTo(-18);
		expect(edgeScrollSpeed(564, 0, 600)).toBeCloseTo(9);
		expect(edgeScrollSpeed(600, 0, 600)).toBeCloseTo(18);
	});

	it('caps the speed past the edges', () => {
		expect(edgeScrollSpeed(-50, 0, 600)).toBeCloseTo(-18);
		expect(edgeScrollSpeed(700, 0, 600)).toBeCloseTo(18);
	});

	it('measures from the given limits', () => {
		expect(edgeScrollSpeed(500, 0, 536)).toBeCloseTo(9);
		expect(edgeScrollSpeed(100, 64, 600)).toBeCloseTo(-9);
	});
});

describe('shouldMove', () => {
	const rect = { top: 100, height: 40 };

	it('moves down past the middle of a later item', () => {
		expect(shouldMove(0, 2, 119, rect)).toBe(false);
		expect(shouldMove(0, 2, 121, rect)).toBe(true);
	});

	it('moves up above the middle of an earlier item', () => {
		expect(shouldMove(3, 1, 121, rect)).toBe(false);
		expect(shouldMove(3, 1, 119, rect)).toBe(true);
	});

	it('never moves onto itself', () => {
		expect(shouldMove(1, 1, 100, rect)).toBe(false);
	});
});
