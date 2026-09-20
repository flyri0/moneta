import { describe, expect, it } from 'vitest';
import {
	addCategory,
	clearSelection,
	groupState,
	selectedCount,
	starterSelection,
	toGroupsInput,
	toggleCategory,
	toggleGroup,
	type StarterGroup
} from './starter-categories';

const DEFAULTS = [
	{ name: 'Bills', categories: ['Rent', 'Utilities'] },
	{ name: 'Fun', categories: ['Hobbies'] }
];

function selection(): StarterGroup[] {
	return starterSelection(DEFAULTS);
}

describe('starterSelection', () => {
	it('offers every default category, all picked', () => {
		expect(selection()).toEqual([
			{
				name: 'Bills',
				categories: [
					{ name: 'Rent', selected: true },
					{ name: 'Utilities', selected: true }
				]
			},
			{ name: 'Fun', categories: [{ name: 'Hobbies', selected: true }] }
		]);
	});
});

describe('toggleCategory', () => {
	it('flips one category and leaves the rest alone', () => {
		const next = toggleCategory(selection(), 0, 1);
		expect(next[0].categories.map((c) => c.selected)).toEqual([true, false]);
		expect(next[1].categories[0].selected).toBe(true);
	});

	it('does not mutate the selection it was given', () => {
		const before = selection();
		toggleCategory(before, 0, 0);
		expect(before[0].categories[0].selected).toBe(true);
	});
});

describe('toggleGroup', () => {
	it('sets every category in the group at once', () => {
		const next = toggleGroup(selection(), 0, false);
		expect(next[0].categories.every((c) => !c.selected)).toBe(true);
		expect(next[1].categories[0].selected).toBe(true);
	});
});

describe('addCategory', () => {
	it('appends a trimmed, picked category', () => {
		const next = addCategory(selection(), 1, '  Concerts  ');
		expect(next[1].categories).toEqual([
			{ name: 'Hobbies', selected: true },
			{ name: 'Concerts', selected: true }
		]);
	});

	it('ignores a blank name', () => {
		expect(addCategory(selection(), 0, '   ')).toEqual(selection());
	});

	it('ignores a name already in that group, but re-picks it', () => {
		const unpicked = toggleCategory(selection(), 0, 0);
		const next = addCategory(unpicked, 0, 'Rent');
		expect(next[0].categories).toHaveLength(2);
		expect(next[0].categories[0].selected).toBe(true);
	});
});

describe('clearSelection', () => {
	it('unpicks everything but keeps the list to pick from again', () => {
		const next = clearSelection(selection());
		expect(selectedCount(next)).toBe(0);
		expect(next.map((g) => g.categories.length)).toEqual([2, 1]);
	});
});

describe('groupState', () => {
	it('tells all, some and none apart', () => {
		const all = selection();
		expect(groupState(all[0])).toBe('all');
		expect(groupState(toggleCategory(all, 0, 0)[0])).toBe('some');
		expect(groupState(toggleGroup(all, 0, false)[0])).toBe('none');
	});

	it('calls a group with no categories none', () => {
		expect(groupState({ name: 'Empty', categories: [] })).toBe('none');
	});
});

describe('toGroupsInput', () => {
	it('keeps only the picked categories', () => {
		const next = toggleCategory(selection(), 0, 1);
		expect(toGroupsInput(next)).toEqual([
			{ name: 'Bills', categories: ['Rent'] },
			{ name: 'Fun', categories: ['Hobbies'] }
		]);
	});

	it('drops a group with nothing picked', () => {
		expect(toGroupsInput(toggleGroup(selection(), 0, false))).toEqual([
			{ name: 'Fun', categories: ['Hobbies'] }
		]);
	});

	it('is empty when the user starts from scratch', () => {
		expect(toGroupsInput(clearSelection(selection()))).toEqual([]);
	});

	it('carries a category the user typed', () => {
		expect(toGroupsInput(addCategory(selection(), 1, 'Concerts'))[1].categories).toEqual([
			'Hobbies',
			'Concerts'
		]);
	});
});

describe('selectedCount', () => {
	it('counts across groups', () => {
		expect(selectedCount(selection())).toBe(3);
		expect(selectedCount(toggleCategory(selection(), 0, 0))).toBe(2);
	});
});
