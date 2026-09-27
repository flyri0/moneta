import { describe, expect, it } from 'vitest';
import { categoryProgress } from './progress';

/** A category view is summarised by the two numbers the row already shows. */
const view = (activity: number, available: number) => ({
	activity,
	available,
	assigned: 0,
	goalNeed: null
});

/** A category with a goal: `assigned` this month, and what the goal needs of it. */
const withGoal = (activity: number, available: number, assigned: number, goalNeed: number) => ({
	activity,
	available,
	assigned,
	goalNeed
});

describe('categoryProgress', () => {
	it('reports an empty envelope as nothing assigned', () => {
		expect(categoryProgress(view(0, 0))).toEqual({
			funded: 0,
			spent: 0,
			inflow: 0,
			overspent: 0,
			percent: 0,
			goal: null
		});
	});

	it('leaves the bar empty when money is assigned but nothing is spent', () => {
		expect(categoryProgress(view(0, 30_000))).toMatchObject({ funded: 30_000, percent: 0 });
	});

	it('measures spending against what was funded', () => {
		expect(categoryProgress(view(-24_000, 6_000))).toEqual({
			funded: 30_000,
			spent: 24_000,
			inflow: 0,
			overspent: 0,
			percent: 80,
			goal: null
		});
	});

	it('fills the bar when the envelope is spent to the cent', () => {
		expect(categoryProgress(view(-30_000, 0))).toMatchObject({ overspent: 0, percent: 100 });
	});

	it('clamps the bar and reports the excess when overspent', () => {
		expect(categoryProgress(view(-8_550, -550))).toEqual({
			funded: 8_000,
			spent: 8_550,
			inflow: 0,
			overspent: 550,
			percent: 100,
			goal: null
		});
	});

	it('counts a refund as an inflow, not as spending', () => {
		expect(categoryProgress(view(1_500, 31_500))).toEqual({
			funded: 30_000,
			spent: 0,
			inflow: 1_500,
			overspent: 0,
			percent: 0,
			goal: null
		});
	});

	it('treats an envelope carrying overspending forward as fully spent', () => {
		expect(categoryProgress(view(-2_000, -5_000))).toEqual({
			funded: -3_000,
			spent: 2_000,
			inflow: 0,
			overspent: 5_000,
			percent: 100,
			goal: null
		});
	});

	it('rounds the bar to whole percent', () => {
		expect(categoryProgress(view(-1, 2)).percent).toBe(33);
	});

	it('stretches the bar to an underfunded goal and marks it', () => {
		// Funded 300 (all assigned), goal 400, 120 spent.
		expect(categoryProgress(withGoal(-12_000, 18_000, 30_000, 40_000))).toMatchObject({
			funded: 30_000,
			percent: 30,
			goal: { toGo: 10_000, funded: 75, at: 100 }
		});
	});

	it('counts what carried over toward the goal line', () => {
		// 100 carried over plus 300 assigned, goal needs 400 this month: 100 to go, at 500.
		expect(categoryProgress(withGoal(0, 40_000, 30_000, 40_000)).goal).toEqual({
			toGo: 10_000,
			funded: 80,
			at: 100
		});
	});

	it('marks a met goal inside the bar, with nothing to go', () => {
		expect(categoryProgress(withGoal(-10_000, 40_000, 50_000, 40_000))).toMatchObject({
			percent: 20,
			goal: { toGo: 0, funded: 100, at: 80 }
		});
	});

	it('keeps the bar clamped when a category with a goal is overspent', () => {
		expect(categoryProgress(withGoal(-50_000, -10_000, 40_000, 40_000))).toMatchObject({
			overspent: 10_000,
			percent: 100,
			goal: { toGo: 0, funded: 100, at: 100 }
		});
	});

	it('shows no goal once a target needs nothing more', () => {
		expect(categoryProgress(withGoal(0, 50_000, 0, 0)).goal).toBeNull();
	});
});
