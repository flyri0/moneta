import { describe, expect, it } from 'vitest';
import { categoryProgress } from './progress';

/** A category view is summarised by the two numbers the row already shows. */
const view = (activity: number, available: number) => ({ activity, available });

describe('categoryProgress', () => {
	it('reports an empty envelope as nothing assigned', () => {
		expect(categoryProgress(view(0, 0))).toEqual({
			funded: 0,
			spent: 0,
			inflow: 0,
			overspent: 0,
			percent: 0
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
			percent: 80
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
			percent: 100
		});
	});

	it('counts a refund as an inflow, not as spending', () => {
		expect(categoryProgress(view(1_500, 31_500))).toEqual({
			funded: 30_000,
			spent: 0,
			inflow: 1_500,
			overspent: 0,
			percent: 0
		});
	});

	it('treats an envelope carrying overspending forward as fully spent', () => {
		expect(categoryProgress(view(-2_000, -5_000))).toEqual({
			funded: -3_000,
			spent: 2_000,
			inflow: 0,
			overspent: 5_000,
			percent: 100
		});
	});

	it('rounds the bar to whole percent', () => {
		expect(categoryProgress(view(-1, 2)).percent).toBe(33);
	});
});
