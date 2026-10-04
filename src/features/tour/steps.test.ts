import { describe, it, expect } from 'vitest';
import { placeCard, resolveStep, TOUR_STEPS, type Box } from './steps';

const step = (id: string) => {
	const found = TOUR_STEPS.find((s) => s.id === id);
	if (!found) throw new Error(id);
	return found;
};

describe('TOUR_STEPS', () => {
	it('opens with an intro and ends on the way to the guide', () => {
		expect(TOUR_STEPS[0].id).toBe('intro');
		expect(TOUR_STEPS.at(-1)?.id).toBe('done');
	});
});

describe('resolveStep', () => {
	const all = (target: string) => `#${target}`;

	it('spotlights the step target', () => {
		expect(resolveStep(step('rta'), all, false)).toEqual({
			element: '#rta',
			copy: 'rta',
			topic: 'readyToAssign'
		});
	});

	it('explains the inline Assigned column where the grid has one', () => {
		expect(resolveStep(step('category'), all, true).copy).toBe('category-wide');
		expect(resolveStep(step('category'), all, false).copy).toBe('category');
	});

	it('points at Add group when the budget has no categories', () => {
		const find = (target: string) => (target === 'category' ? null : `#${target}`);
		expect(resolveStep(step('category'), find, true)).toEqual({
			element: '#add-group',
			copy: 'add-group',
			topic: 'categories'
		});
	});

	it('shows a step with nothing to point at in the middle', () => {
		const resolved = resolveStep(step('category'), () => null, false);
		expect(resolved.element).toBeNull();
		expect(resolved.copy).toBe('category');
	});

	it('has nothing to look for on the intro', () => {
		expect(resolveStep(step('intro'), all, false).element).toBeNull();
	});
});

describe('placeCard', () => {
	const viewport = { width: 1280, height: 800 };
	const card = { width: 384, height: 200 };
	const box = (x: number, y: number, width: number, height: number): Box => ({
		x,
		y,
		width,
		height
	});

	it('centers the card without a target', () => {
		expect(placeCard(null, card, viewport, false)).toEqual({ x: 448, y: 300 });
	});

	it('puts the card below a target near the top', () => {
		expect(placeCard(box(400, 100, 600, 80), card, viewport, false)).toEqual({ x: 400, y: 196 });
	});

	it('puts the card above a target near the bottom', () => {
		expect(placeCard(box(400, 600, 600, 150), card, viewport, false)).toEqual({ x: 400, y: 384 });
	});

	it('puts the card beside a target in the sidebar', () => {
		expect(placeCard(box(16, 300, 200, 36), card, viewport, false)).toEqual({ x: 232, y: 300 });
	});

	it('keeps the card inside the window', () => {
		const placed = placeCard(box(1200, 100, 60, 40), card, viewport, false);
		expect(placed.x + card.width).toBeLessThanOrEqual(viewport.width - 16);
	});

	describe('on a phone', () => {
		const phone = { width: 390, height: 844 };
		const wide = { width: 358, height: 180 };

		it('spans the width below a target in the top half', () => {
			expect(placeCard(box(16, 120, 358, 140), wide, phone, true)).toEqual({ x: 16, y: 276 });
		});

		it('sits above a target in the bottom half', () => {
			expect(placeCard(box(156, 790, 78, 54), wide, phone, true)).toEqual({ x: 16, y: 594 });
		});
	});
});
