import { describe, it, expect } from 'vitest';
import { goalNeed, type CategoryGoal } from './goal';

const monthly: CategoryGoal = { type: 'monthly', amount: 40000, month: null };

describe('goalNeed', () => {
	it('asks a monthly goal for its amount every month, whatever carried over', () => {
		expect(goalNeed(monthly, '2026-04', { carryover: 0 })).toBe(40000);
		expect(goalNeed(monthly, '2026-04', { carryover: 25000 })).toBe(40000);
	});

	it('asks a target with no month for all that is left to reach it', () => {
		const goal: CategoryGoal = { type: 'target', amount: 500000, month: null };
		expect(goalNeed(goal, '2026-04', { carryover: 120000 })).toBe(380000);
	});

	it('asks nothing once the balance has reached the target', () => {
		const goal: CategoryGoal = { type: 'target', amount: 500000, month: null };
		expect(goalNeed(goal, '2026-04', { carryover: 500000 })).toBe(0);
		expect(goalNeed(goal, '2026-04', { carryover: 600000 })).toBe(0);
	});

	it('asks for more when overspending carried over', () => {
		const goal: CategoryGoal = { type: 'target', amount: 10000, month: null };
		expect(goalNeed(goal, '2026-04', { carryover: -2000 })).toBe(12000);
	});

	it('spreads a dated target over the months left, the target month included', () => {
		const goal: CategoryGoal = { type: 'target', amount: 120000, month: '2026-12' };
		// 9 months from April to December.
		expect(goalNeed(goal, '2026-04', { carryover: 30000 })).toBe(10000);
		expect(goalNeed(goal, '2026-12', { carryover: 110000 })).toBe(10000);
	});

	it('rounds a dated share up, so the last month never falls short', () => {
		const goal: CategoryGoal = { type: 'target', amount: 100000, month: '2026-06' };
		expect(goalNeed(goal, '2026-04', { carryover: 0 })).toBe(33334);
	});

	it('asks for everything left once the target month has passed', () => {
		const goal: CategoryGoal = { type: 'target', amount: 100000, month: '2026-03' };
		expect(goalNeed(goal, '2026-05', { carryover: 70000 })).toBe(30000);
	});
});
