import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, run } from '../connection';
import {
	createCategory,
	createGroup,
	deleteCategory,
	deleteGroup,
	getCategory,
	listCategoryTree,
	saveCategoryOrder,
	updateCategory,
	updateGroup
} from './categories';
import { createAccount } from './accounts';
import { createTransaction } from './transactions';

const code = (c: string) => expect.objectContaining({ code: c });

describe('category groups', () => {
	it('creates, renames, hides and deletes a group', async () => {
		const db = await createBudgetDb();
		const id = createGroup(db, { name: 'Savings' });
		updateGroup(db, id, { name: 'Goals', hidden: true });
		const group = listCategoryTree(db).find((g) => g.id === id)!;
		expect(group).toMatchObject({ name: 'Goals', hidden: true, categories: [] });
		deleteGroup(db, id);
		expect(listCategoryTree(db).some((g) => g.id === id)).toBe(false);
	});

	it('refuses to delete non-empty or system groups', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		expect(() => deleteGroup(db, tree.find((g) => g.name === 'Bills')!.id)).toThrow(
			code('GROUP_NOT_EMPTY')
		);
		expect(() => deleteGroup(db, tree[0].id)).toThrow(code('SYSTEM_ENTITY_READONLY'));
		expect(() => updateGroup(db, tree[1].id, { name: 'x' })).toThrow(
			code('SYSTEM_ENTITY_READONLY')
		);
	});
});

describe('categories', () => {
	it('creates a category at the end of its group', async () => {
		const db = await createBudgetDb();
		const bills = listCategoryTree(db).find((g) => g.name === 'Bills')!;
		const id = createCategory(db, { groupId: bills.id, name: 'Internet' });
		expect(getCategory(db, id)).toMatchObject({ name: 'Internet', sortOrder: 2, hidden: false });
	});

	it('updates name, group, hidden and the overspending toggle', async () => {
		const db = await createBudgetDb();
		const everyday = listCategoryTree(db).find((g) => g.name === 'Everyday')!;
		const rent = categoryId(db, 'Rent');
		updateCategory(db, rent, {
			name: 'Housing',
			groupId: everyday.id,
			hidden: true,
			carryoverOverspending: true
		});
		expect(getCategory(db, rent)).toMatchObject({
			name: 'Housing',
			groupId: everyday.id,
			hidden: true,
			carryoverOverspending: true
		});
	});

	it('protects system and card payment categories', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		expect(() => updateCategory(db, categoryId(db, 'Ready to Assign'), { name: 'x' })).toThrow(
			code('SYSTEM_ENTITY_READONLY')
		);
		expect(() => createCategory(db, { groupId: tree[1].id, name: 'x' })).toThrow(
			code('SYSTEM_ENTITY_READONLY')
		);
		createAccount(db, {
			name: 'Visa',
			type: 'credit_card',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		const visa = categoryId(db, 'Visa');
		expect(() => updateCategory(db, visa, { name: 'x' })).toThrow(code('SYSTEM_ENTITY_READONLY'));
		updateCategory(db, visa, { carryoverOverspending: true });
		expect(getCategory(db, visa).carryoverOverspending).toBe(true);
		expect(() => deleteCategory(db, visa)).toThrow(code('SYSTEM_ENTITY_READONLY'));
	});

	it('deletes an unused category directly', async () => {
		const db = await createBudgetDb();
		deleteCategory(db, categoryId(db, 'Fun'));
		expect(() => categoryId(db, 'Fun')).toThrow();
	});

	it('requires and performs reassignment when the category is in use', async () => {
		const db = await createBudgetDb();
		const food = categoryId(db, 'Food');
		const fun = categoryId(db, 'Fun');
		const bank = createAccount(db, {
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		createTransaction(db, { accountId: bank, date: '2026-01-05', amount: -1000, categoryId: fun });
		const assign = 'INSERT INTO budget_assignments (category_id, month, assigned) VALUES (?, ?, ?)';
		run(db, assign, [fun, '2026-01', 3000]);
		run(db, assign, [food, '2026-01', 2000]);

		expect(() => deleteCategory(db, fun)).toThrow(code('REASSIGN_REQUIRED'));
		deleteCategory(db, fun, food);

		expect(all(db, 'SELECT category_id AS c, amount FROM transactions')).toEqual([
			{ c: food, amount: -1000 }
		]);
		expect(all(db, 'SELECT category_id AS c, month, assigned FROM budget_assignments')).toEqual([
			{ c: food, month: '2026-01', assigned: 5000 }
		]);
	});

	it('saves drag-and-drop order across groups', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		const bills = tree.find((g) => g.name === 'Bills')!;
		const everyday = tree.find((g) => g.name === 'Everyday')!;
		saveCategoryOrder(db, [
			{ groupId: tree[0].id, categoryIds: tree[0].categories.map((c) => c.id) },
			{ groupId: tree[1].id, categoryIds: [] },
			{
				groupId: everyday.id,
				categoryIds: [categoryId(db, 'Fun'), categoryId(db, 'Rent'), categoryId(db, 'Food')]
			},
			{ groupId: bills.id, categoryIds: [categoryId(db, 'Utilities')] }
		]);
		const after = listCategoryTree(db);
		expect(after.map((g) => g.name)).toEqual([
			'Income',
			'Credit Card Payments',
			'Everyday',
			'Bills'
		]);
		expect(after[2].categories.map((c) => c.name)).toEqual(['Fun', 'Rent', 'Food']);
	});

	it('keeps the system groups first whatever order is saved', async () => {
		const db = await createBudgetDb();
		const [income, cards, bills, everyday] = listCategoryTree(db);
		saveCategoryOrder(
			db,
			[everyday, cards, bills, income].map((g) => ({
				groupId: g.id,
				categoryIds: g.categories.map((c) => c.id)
			}))
		);
		expect(listCategoryTree(db).map((g) => g.name)).toEqual([
			'Income',
			'Credit Card Payments',
			'Everyday',
			'Bills'
		]);
	});

	it('refuses to move categories into system groups', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		expect(() =>
			saveCategoryOrder(db, [{ groupId: tree[1].id, categoryIds: [categoryId(db, 'Food')] }])
		).toThrow(code('SYSTEM_ENTITY_READONLY'));
	});
});
