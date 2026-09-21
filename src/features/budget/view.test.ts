import { describe, it, expect } from 'vitest';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$db/repos/budget';
import { availableTone, gridModel, moveTargets } from './view';

const cat = (id: string, p: Partial<BudgetCategoryView> = {}): BudgetCategoryView => ({
	id,
	name: id,
	hidden: false,
	carryoverOverspending: false,
	carryover: 0,
	assigned: 0,
	activity: 0,
	available: 0,
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

describe('availableTone (Actual Budget model)', () => {
	it('returns positive when available > 0', () => {
		expect(availableTone({ available: 100, carryoverOverspending: false })).toBe('positive');
	});

	it('returns zero when available === 0', () => {
		expect(availableTone({ available: 0, carryoverOverspending: false })).toBe('zero');
	});

	it('returns overspent (red) when available < 0 and carryover is false', () => {
		expect(availableTone({ available: -100, carryoverOverspending: false })).toBe('overspent');
	});

	it('returns carryover (amber) when available < 0 and carryover is true', () => {
		expect(availableTone({ available: -100, carryoverOverspending: true })).toBe('carryover');
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

	it('shows empty user groups but not an empty income group', () => {
		const model = gridModel(month([group('Income', [], { system: 'income' }), group('New', [])]));
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

	it('excludes categories belonging to system groups', () => {
		const model = gridModel(
			month([
				group('Income', [cat('Salary')], { system: 'income' }),
				group('Bills', [cat('Rent'), cat('Power')])
			])
		);
		const targets = moveTargets(model, 'Rent');
		expect(targets.map((t) => t.name)).toEqual(['Power']);
	});
});
