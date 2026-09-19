import { describe, it, expect } from 'vitest';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$lib/db/repos/budget';
import { availableTone, gridModel, moveTargets } from './view';

const cat = (id: string, p: Partial<BudgetCategoryView> = {}): BudgetCategoryView => ({
	id,
	name: id,
	hidden: false,
	carryoverOverspending: false,
	ccAccountId: null,
	carryover: 0,
	assigned: 0,
	activity: 0,
	available: 0,
	cashOverspent: 0,
	creditOverspent: 0,
	...p
});

const group = (
	id: string,
	categories: BudgetCategoryView[],
	p: Partial<BudgetGroupView> = {}
): BudgetGroupView => ({
	id,
	name: id,
	hidden: false,
	system: null,
	assigned: 0,
	activity: 0,
	available: 0,
	categories,
	...p
});

const month = (groups: BudgetGroupView[]): BudgetMonthView => ({
	month: '2026-09',
	readyToAssign: 0,
	availableFunds: 0,
	overspentLastMonth: 0,
	assignedThisMonth: 0,
	futureNegativeMonth: null,
	groups
});

describe('availableTone', () => {
	it('is green, neutral, yellow for uncovered card spending, and red for cash overspending', () => {
		expect(availableTone({ available: 100, cashOverspent: 0 })).toBe('positive');
		expect(availableTone({ available: 0, cashOverspent: 0 })).toBe('zero');
		expect(availableTone({ available: -100, cashOverspent: 0 })).toBe('credit');
		expect(availableTone({ available: -100, cashOverspent: 40 })).toBe('overspent');
	});
});

describe('gridModel', () => {
	it('moves hidden categories and hidden groups into the hidden section', () => {
		const model = gridModel(
			month([
				group('Bills', [cat('Rent'), cat('Old', { hidden: true })]),
				group('Archive', [cat('Gym')], { hidden: true })
			])
		);
		expect(model.groups.map((g) => [g.name, g.categories.map((c) => c.name)])).toEqual([
			['Bills', ['Rent']]
		]);
		expect(model.hidden.map((h) => `${h.group.name}/${h.category.name}`)).toEqual([
			'Bills/Old',
			'Archive/Gym'
		]);
	});

	it('shows empty user groups but not an empty card payments group', () => {
		const model = gridModel(
			month([group('Cards', [], { system: 'credit_card_payments' }), group('New', [])])
		);
		expect(model.groups.map((g) => g.name)).toEqual(['New']);
	});
});

describe('moveTargets', () => {
	it('lists the other visible categories with their group', () => {
		const model = gridModel(month([group('Bills', [cat('Rent'), cat('Power')])]));
		expect(moveTargets(model, 'Rent')).toEqual([
			{ id: 'Power', name: 'Power', group: { name: 'Bills', system: null } }
		]);
	});
});
