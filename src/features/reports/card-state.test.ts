import { describe, expect, it } from 'vitest';
import { monthsWithFlow, monthsWithSpending } from './card-state';

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

	it('counts the months with spending', () => {
		expect(monthsWithSpending([0, 0, 120, 0])).toBe(1);
	});
});
