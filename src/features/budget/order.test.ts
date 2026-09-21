import { describe, it, expect } from 'vitest';
import { dropCategory, moveCategory, moveGroup, toPayload, type OrderLayout } from './order';

const layout: OrderLayout = [
	{
		id: 'income',
		name: 'Income',
		system: 'income',
		categories: [{ id: 'salary', name: 'Salary' }]
	},
	{
		id: 'bills',
		name: 'Bills',
		system: null,
		categories: [
			{ id: 'rent', name: 'Rent' },
			{ id: 'power', name: 'Power' }
		]
	},
	{ id: 'fun', name: 'Fun', system: null, categories: [{ id: 'games', name: 'Games' }] }
];

const shape = (l: OrderLayout) =>
	l.map((g) => `${g.id}:${g.categories.map((c) => c.id).join(',')}`);

describe('moveGroup', () => {
	it('swaps user groups', () => {
		expect(shape(moveGroup(layout, 'fun', -1))).toEqual([
			'income:salary',
			'fun:games',
			'bills:rent,power'
		]);
	});

	it('never moves system groups or moves anything above them', () => {
		expect(moveGroup(layout, 'income', 1)).toBe(layout);
		expect(moveGroup(layout, 'bills', -1)).toBe(layout);
		expect(moveGroup(layout, 'fun', 1)).toBe(layout);
	});
});

describe('moveCategory', () => {
	it('moves within a group', () => {
		expect(shape(moveCategory(layout, 'power', -1))).toEqual([
			'income:salary',
			'bills:power,rent',
			'fun:games'
		]);
	});

	it('crosses into the neighbouring user group at the edges', () => {
		expect(shape(moveCategory(layout, 'power', 1))).toEqual([
			'income:salary',
			'bills:rent',
			'fun:power,games'
		]);
		expect(shape(moveCategory(layout, 'games', -1))).toEqual([
			'income:salary',
			'bills:rent,power,games',
			'fun:'
		]);
	});

	it('never crosses into or out of a system group', () => {
		expect(moveCategory(layout, 'rent', -1)).toBe(layout);
		expect(moveCategory(layout, 'salary', 1)).toBe(layout);
	});
});

describe('dropCategory', () => {
	it('drops at an index, clamped to the group', () => {
		expect(shape(dropCategory(layout, 'rent', 'fun', 99))).toEqual([
			'income:salary',
			'bills:power',
			'fun:games,rent'
		]);
		expect(dropCategory(layout, 'rent', 'income', 0)).toBe(layout);
	});

	it('does not change the original layout', () => {
		dropCategory(layout, 'rent', 'fun', 0);
		expect(shape(layout)).toEqual(['income:salary', 'bills:rent,power', 'fun:games']);
	});
});

describe('toPayload', () => {
	it('lists group ids with their category ids', () => {
		expect(toPayload(layout)[1]).toEqual({ groupId: 'bills', categoryIds: ['rent', 'power'] });
	});
});
