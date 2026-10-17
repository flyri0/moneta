import { describe, expect, it } from 'vite-plus/test';
import { chartWaitsForNextMonth, flowMonths, monthsWithFlow } from './card-state';

describe('card state', () => {
	it('counts the months with income or spending', () => {
		expect(
			monthsWithFlow([
				{ income: 0, spending: 0 },
				{ income: 100, spending: 0 },
				{ income: 0, spending: 50 }
			])
		).toBe(2);
	});

	it('marks the months with flow', () => {
		expect(
			flowMonths([
				{ income: 0, spending: 0 },
				{ income: 1, spending: 0 }
			])
		).toEqual([false, true]);
	});

	it('waits for next month only when the single month with data is the current one', () => {
		expect(chartWaitsForNextMonth([false, false, true])).toBe(true);
		expect(chartWaitsForNextMonth([false, true, false])).toBe(false);
		expect(chartWaitsForNextMonth([true, false, true])).toBe(false);
		expect(chartWaitsForNextMonth([false, false, false])).toBe(false);
	});
});
