import { describe, it, expect } from 'vitest';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$db/repos/budget';
import {
	availableTone,
	gridModel,
	moveTargets,
	overspentCategories,
	overspentCount,
	rtaTone
} from './view';

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

describe('rtaTone', () => {
	it('approves a budget where every unit has a job', () => {
		expect(rtaTone(0)).toBe('assigned');
	});

	it('flags money still waiting for a job', () => {
		expect(rtaTone(1)).toBe('unassigned');
	});

	it('flags assigning more than there is', () => {
		expect(rtaTone(-1)).toBe('overassigned');
	});
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

describe('overspentCategories', () => {
	const over = (id: string, p: Partial<BudgetCategoryView> = {}) =>
		cat(id, { available: -500, ...p });

	it('lists overspent categories in grid order, the hidden section last', () => {
		const model = gridModel(
			month([
				group('Bills', [over('Old', { hidden: true }), cat('Rent'), over('Power')]),
				group('Fun', [over('Games')])
			])
		);
		expect(overspentCategories(model).map((c) => c.name)).toEqual(['Power', 'Games', 'Old']);
	});

	it('leaves out rolled-over overspending and income', () => {
		const model = gridModel(
			month([
				group('Income', [over('Salary')], { system: 'income' }),
				group('Bills', [over('Card', { carryoverOverspending: true })])
			])
		);
		expect(overspentCategories(model)).toEqual([]);
	});
});

describe('overspentCount', () => {
	it('counts the overspent categories a group shows', () => {
		const bills = group('Bills', [
			cat('Rent', { available: -1 }),
			cat('Power', { available: -1, carryoverOverspending: true }),
			cat('Water', { available: 1 })
		]);
		expect(overspentCount(bills)).toBe(1);
	});

	it('never counts income', () => {
		const income = group('Income', [cat('Salary', { available: -1 })], { system: 'income' });
		expect(overspentCount(income)).toBe(0);
	});
});
