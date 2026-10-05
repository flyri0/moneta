import { describe, it, expect } from 'vitest';
import { placeCard, resolveStep, TOUR_STEPS, type Box } from './steps';

const step = (id: string) => {
	const found = TOUR_STEPS.find((s) => s.id === id);
	if (!found) throw new Error(id);
	return found;
};

describe('TOUR_STEPS', () => {
	it('opens with an intro on the budget and ends in Settings', () => {
		expect(TOUR_STEPS[0]).toMatchObject({ id: 'intro', route: 'budget' });
		expect(TOUR_STEPS.at(-1)).toMatchObject({ id: 'done', route: 'settings' });
	});

	it('shows the way into every screen before going there', () => {
		for (let i = 1; i < TOUR_STEPS.length; i++) {
			const [before, step] = [TOUR_STEPS[i - 1], TOUR_STEPS[i]];
			if (step.route === before.route) continue;
			expect(before.leadsTo, `${before.id} leads to ${step.route}`).toBe(step.route);
			expect(before.target).toBeDefined();
		}
	});

	it('only leads somewhere from a step that goes there next', () => {
		TOUR_STEPS.forEach((step, i) => {
			if (step.leadsTo) expect(TOUR_STEPS[i + 1].route).toBe(step.leadsTo);
		});
	});
});

describe('resolveStep', () => {
	const all = (target: string) => `#${target}`;
	const plain = { wide: false, cloud: false };

	it('points at Schedules, or at Transactions where Schedules is a tab inside it', () => {
		expect(resolveStep(step('schedules-way'), all, plain)).toEqual({
			element: '#schedules',
			copy: 'schedules-way',
			topic: undefined
		});
		const phone = (target: string) => (target === 'schedules' ? null : `#${target}`);
		expect(resolveStep(step('schedules-way'), phone, plain)).toEqual({
			element: '#transactions',
			copy: 'schedules-way-phone',
			topic: undefined
		});
	});

	it('spotlights the step target', () => {
		expect(resolveStep(step('rta'), all, plain)).toEqual({
			element: '#rta',
			copy: 'rta',
			topic: 'readyToAssign'
		});
	});

	it('explains the inline Assigned column where the grid has one', () => {
		expect(resolveStep(step('category'), all, { wide: true, cloud: false }).copy).toBe(
			'category-wide'
		);
		expect(resolveStep(step('category'), all, plain).copy).toBe('category');
	});

	it('mentions automatic backups only where this build has them', () => {
		expect(resolveStep(step('backup'), all, plain)).toMatchObject({
			copy: 'backup',
			topic: 'backups'
		});
		expect(resolveStep(step('backup'), all, { wide: false, cloud: true })).toMatchObject({
			copy: 'backup-cloud',
			topic: 'googleDrive'
		});
	});

	it('points at Add group when the budget has no categories', () => {
		const find = (target: string) => (target === 'category' ? null : `#${target}`);
		expect(resolveStep(step('category'), find, plain)).toEqual({
			element: '#add-group',
			copy: 'add-group',
			topic: 'categories'
		});
	});

	it('shows a step with nothing to point at in the middle', () => {
		const resolved = resolveStep(step('category'), () => null, plain);
		expect(resolved.element).toBeNull();
		expect(resolved.copy).toBe('category');
	});

	it('has nothing to look for on the intro', () => {
		expect(resolveStep(step('intro'), all, plain).element).toBeNull();
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
