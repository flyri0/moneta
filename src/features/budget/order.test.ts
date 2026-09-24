import { describe, it, expect } from 'vitest';
import {
	dropCategory,
	dropGroup,
	moveCategory,
	moveGroup,
	toPayload,
	type OrderLayout
} from './order';

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
	it('swaps neighbouring groups', () => {
		expect(shape(moveGroup(layout, 'fun', -1))).toEqual([
			'income:salary',
			'fun:games',
			'bills:rent,power'
		]);
	});

	it('moves the Income group too', () => {
		expect(shape(moveGroup(layout, 'income', 1))).toEqual([
			'bills:rent,power',
			'income:salary',
			'fun:games'
		]);
		expect(shape(moveGroup(layout, 'bills', -1))[0]).toBe('bills:rent,power');
	});

	it('stops at the ends', () => {
		expect(moveGroup(layout, 'income', -1)).toBe(layout);
		expect(moveGroup(layout, 'fun', 1)).toBe(layout);
	});
});

describe('dropGroup', () => {
	const ids = (l: OrderLayout) => l.map((g) => g.id);

	it('places a group at an index', () => {
		expect(ids(dropGroup(layout, 'fun', 0))).toEqual(['fun', 'income', 'bills']);
		expect(ids(dropGroup(layout, 'income', 1))).toEqual(['bills', 'income', 'fun']);
		expect(ids(dropGroup(layout, 'income', 2))).toEqual(['bills', 'fun', 'income']);
	});

	it('clamps the index', () => {
		expect(ids(dropGroup(layout, 'income', 99))).toEqual(['bills', 'fun', 'income']);
		expect(ids(dropGroup(layout, 'fun', -5))).toEqual(['fun', 'income', 'bills']);
	});

	it('returns the same layout when nothing moves', () => {
		expect(dropGroup(layout, 'bills', 1)).toBe(layout);
		expect(dropGroup(layout, 'nope', 0)).toBe(layout);
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

	it('skips an Income group placed between user groups', () => {
		const middle = moveGroup(layout, 'income', 1);
		expect(shape(moveCategory(middle, 'power', 1))).toEqual([
			'bills:rent',
			'income:salary',
			'fun:power,games'
		]);
		expect(shape(moveCategory(middle, 'games', -1))).toEqual([
			'bills:rent,power,games',
			'income:salary',
			'fun:'
		]);
	});

	it('reorders Income categories only within Income', () => {
		const income: OrderLayout = [
			{ ...layout[1] },
			{
				...layout[0],
				categories: [
					{ id: 'salary', name: 'Salary' },
					{ id: 'bonus', name: 'Bonus' }
				]
			}
		];
		expect(shape(moveCategory(income, 'bonus', -1))[1]).toBe('income:bonus,salary');
		expect(moveCategory(income, 'salary', -1)).toBe(income);
		expect(moveCategory(income, 'bonus', 1)).toBe(income);
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
