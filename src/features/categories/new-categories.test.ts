import { describe, expect, it, vi } from 'vitest';
import {
	NewCategories,
	categoryValues,
	withCategoryIds,
	type CreatesCategories
} from './new-categories';

function fakeApi(fail = new Set<string>()) {
	let n = 0;
	const createIn = vi.fn(
		async (input: { name: string; group: { id: string } | { name: string } }) => {
			if (fail.has(input.name)) throw new Error('offline');
			n++;
			return { categoryId: `c${n}`, groupId: 'id' in input.group ? input.group.id : `g${n}` };
		}
	);
	const createGroup = vi.fn(async (input: { name: string }) => {
		if (fail.has(input.name)) throw new Error('offline');
		n++;
		return `g${n}`;
	});
	return {
		api: { categories: { createIn, createGroup } } as unknown as CreatesCategories,
		createIn,
		createGroup
	};
}

const both = (c: string, g: string) => `${c} · ${g}`;

describe('NewCategories', () => {
	it('gives one token per name and group', () => {
		const pending = new NewCategories();
		const pet = pending.add('Pet', { id: 'g1' });
		expect(pending.add(' pet ', { id: 'g1' })).toBe(pet);
		expect(pending.add('Pet', { id: 'g2' })).not.toBe(pet);
		expect(NewCategories.isToken(pet)).toBe(true);
		expect(NewCategories.isToken('01a0e46b')).toBe(false);
	});

	it('labels a token, with its group when the group is new', () => {
		const pending = new NewCategories();
		expect(pending.label(pending.add('Pet', { id: 'g1' }), both)).toBe('Pet');
		expect(pending.label(pending.add('Vet', { name: 'Pets' }), both)).toBe('Vet · Pets');
		expect(pending.label('other', both)).toBeNull();
	});

	it('creates only the tokens used, once each, and a new group once', async () => {
		const pending = new NewCategories();
		const vet = pending.add('Vet', { name: 'Pets' });
		const food = pending.add('Pet food', { name: 'pets' });
		pending.add('Unused', { id: 'g1' });
		const { api, createIn } = fakeApi();

		const ids = await pending.resolve(api, [vet, food, vet, 'c-existing', null]);
		expect(ids).toEqual(
			new Map([
				[vet, 'c1'],
				[food, 'c2']
			])
		);
		expect(createIn.mock.calls.map(([input]) => input)).toEqual([
			{ name: 'Vet', group: { name: 'Pets' } },
			{ name: 'Pet food', group: { id: 'g1' } }
		]);

		await pending.resolve(api, [vet]);
		expect(createIn).toHaveBeenCalledTimes(2);
	});

	it('creates only what is missing after a failure', async () => {
		const pending = new NewCategories();
		const a = pending.add('A', { id: 'g1' });
		const b = pending.add('B', { id: 'g1' });
		await expect(pending.resolve(fakeApi(new Set(['B'])).api, [a, b])).rejects.toThrow('offline');
		const { api, createIn } = fakeApi();
		const ids = await pending.resolve(api, [a, b]);
		expect(createIn.mock.calls.map(([input]) => input.name)).toEqual(['B']);
		expect(ids.get(a)).toBe('c1');
		expect(ids.get(b)).toBe('c1');
	});
});

describe('NewCategories groups', () => {
	it('gives one token per group name, told apart from categories', () => {
		const pending = new NewCategories();
		const pets = pending.addGroup('Pets');
		expect(pending.addGroup(' pets ')).toBe(pets);
		expect(pending.addGroup('Home')).not.toBe(pets);
		expect(NewCategories.isToken(pets)).toBe(true);
		expect(NewCategories.isGroupToken(pets)).toBe(true);
		expect(NewCategories.isGroupToken(pending.add('Vet', { id: 'g1' }))).toBe(false);
		expect(pending.label(pets, both)).toBe('Pets');
	});

	it('creates a new group once, shared with categories added to a group of that name', async () => {
		const pending = new NewCategories();
		const pets = pending.addGroup('Pets');
		const vet = pending.add('Vet', { name: 'pets' });
		const { api, createIn, createGroup } = fakeApi();

		const ids = await pending.resolve(api, [pets, vet]);
		expect(ids).toEqual(
			new Map([
				[pets, 'g1'],
				[vet, 'c2']
			])
		);
		expect(createGroup).toHaveBeenCalledTimes(1);
		expect(createIn.mock.calls.map(([input]) => input)).toEqual([
			{ name: 'Vet', group: { id: 'g1' } }
		]);

		await pending.resolve(api, [pets]);
		expect(createGroup).toHaveBeenCalledTimes(1);
	});

	it('reuses a group a category created', async () => {
		const pending = new NewCategories();
		const vet = pending.add('Vet', { name: 'Pets' });
		const pets = pending.addGroup('Pets');
		const { api, createGroup } = fakeApi();

		const ids = await pending.resolve(api, [vet, pets]);
		expect(ids.get(pets)).toBe('g1');
		expect(createGroup).not.toHaveBeenCalled();
	});

	it('creates the group again after a failure', async () => {
		const pending = new NewCategories();
		const pets = pending.addGroup('Pets');
		await expect(pending.resolve(fakeApi(new Set(['Pets'])).api, [pets])).rejects.toThrow(
			'offline'
		);
		const { api, createGroup } = fakeApi();
		expect((await pending.resolve(api, [pets])).get(pets)).toBe('g1');
		expect(createGroup).toHaveBeenCalledTimes(1);
	});
});

describe('withCategoryIds', () => {
	it('swaps tokens in the category and the split lines', () => {
		const ids = new Map([['new-category:1', 'real']]);
		const input = {
			amount: -100,
			categoryId: 'new-category:1',
			splits: [
				{ categoryId: 'new-category:1', amount: -60 },
				{ categoryId: 'food', amount: -40 }
			]
		};
		expect(withCategoryIds(input, ids)).toEqual({
			amount: -100,
			categoryId: 'real',
			splits: [
				{ categoryId: 'real', amount: -60 },
				{ categoryId: 'food', amount: -40 }
			]
		});
		expect(categoryValues(input)).toEqual(['new-category:1', 'new-category:1', 'food']);
		expect(withCategoryIds({ categoryId: null }, ids)).toEqual({ categoryId: null });
	});
});
