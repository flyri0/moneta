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
		expect(() => updateGroup(db, tree[0].id, { name: 'x' })).toThrow(
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

	it('allows creating, renaming, and deleting categories within Income group', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		const id = createCategory(db, { groupId: income.id, name: 'Freelance' });
		expect(getCategory(db, id)).toMatchObject({ name: 'Freelance' });

		updateCategory(db, id, { name: 'Consulting' });
		expect(getCategory(db, id)).toMatchObject({ name: 'Consulting' });

		deleteCategory(db, id);
		expect(() => getCategory(db, id)).toThrow();
	});

	it('allows hiding categories in Income group', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		const salary = income.categories[0].id;
		updateCategory(db, salary, { hidden: true });
		expect(getCategory(db, salary).hidden).toBe(true);
	});

	it('prevents moving categories between income and regular groups', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		const income = tree.find((g) => g.system === 'income')!;
		const regular = tree.find((g) => !g.system)!;

		const id = createCategory(db, { groupId: income.id, name: 'Dividends' });
		expect(() => updateCategory(db, id, { groupId: regular.id })).toThrow(
			code('CATEGORY_NOT_ALLOWED')
		);
		expect(() => updateCategory(db, regular.categories[0].id, { groupId: income.id })).toThrow(
			code('CATEGORY_NOT_ALLOWED')
		);
	});

	it('disallows carryoverOverspending on categories in the Income group', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		const salary = income.categories[0].id;
		expect(() => updateCategory(db, salary, { carryoverOverspending: true })).toThrow(
			code('CATEGORY_NOT_ALLOWED')
		);
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
		run(
			db,
			"INSERT INTO accounts (id, name, type, on_budget, sort_order, created_at) VALUES ('acc1', 'Bank', 'checking', 1, 0, '2026-01-01T00:00:00Z')"
		);
		run(
			db,
			'INSERT INTO transactions (id, account_id, date, amount, category_id) VALUES (?, ?, ?, ?, ?)',
			['tx1', 'acc1', '2026-01-05', -1000, fun]
		);
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

	it('requires reassignment category to be of the same kind when category is in use', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		const [sal, other] = income.categories;
		const food = categoryId(db, 'Food');

		run(
			db,
			"INSERT INTO accounts (id, name, type, on_budget, sort_order, created_at) VALUES ('acc1', 'Bank', 'checking', 1, 0, '2026-01-01T00:00:00Z')"
		);
		run(
			db,
			'INSERT INTO transactions (id, account_id, date, amount, category_id) VALUES (?, ?, ?, ?, ?)',
			['tx1', 'acc1', '2026-01-01', 1000, sal.id]
		);

		// cannot reassign income to regular
		expect(() => deleteCategory(db, sal.id, food)).toThrow(code('CATEGORY_NOT_ALLOWED'));

		// can reassign income to income
		deleteCategory(db, sal.id, other.id);
		expect(() => getCategory(db, sal.id)).toThrow();

		// cannot reassign regular to income
		run(
			db,
			'INSERT INTO transactions (id, account_id, date, amount, category_id) VALUES (?, ?, ?, ?, ?)',
			['tx2', 'acc1', '2026-01-02', -500, food]
		);
		expect(() => deleteCategory(db, food, other.id)).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});

	it('saves drag-and-drop order across groups', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		const income = tree.find((g) => g.system === 'income')!;
		const bills = tree.find((g) => g.name === 'Bills')!;
		const everyday = tree.find((g) => g.name === 'Everyday')!;
		saveCategoryOrder(db, [
			{ groupId: income.id, categoryIds: income.categories.map((c) => c.id) },
			{
				groupId: everyday.id,
				categoryIds: [categoryId(db, 'Fun'), categoryId(db, 'Rent'), categoryId(db, 'Food')]
			},
			{ groupId: bills.id, categoryIds: [categoryId(db, 'Utilities')] }
		]);
		const after = listCategoryTree(db);
		expect(after.map((g) => g.name)).toEqual(['Income', 'Everyday', 'Bills']);
		expect(after[1].categories.map((c) => c.name)).toEqual(['Fun', 'Rent', 'Food']);
	});

	it('keeps the system groups first whatever order is saved', async () => {
		const db = await createBudgetDb();
		const [income, bills, everyday] = listCategoryTree(db);
		saveCategoryOrder(
			db,
			[everyday, bills, income].map((g) => ({
				groupId: g.id,
				categoryIds: g.categories.map((c) => c.id)
			}))
		);
		expect(listCategoryTree(db).map((g) => g.name)).toEqual(['Income', 'Everyday', 'Bills']);
	});

	it('allows reordering categories within the Income group', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		expect(income.categories.length).toBeGreaterThanOrEqual(2);
		const [c0, c1] = income.categories;
		saveCategoryOrder(db, [{ groupId: income.id, categoryIds: [c1.id, c0.id] }]);
		const afterIncome = listCategoryTree(db).find((g) => g.system === 'income')!;
		expect(afterIncome.categories[0].id).toBe(c1.id);
		expect(afterIncome.categories[1].id).toBe(c0.id);
	});

	it('refuses to move categories between income and regular groups in saveCategoryOrder', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		const income = tree.find((g) => g.system === 'income')!;
		const bills = tree.find((g) => g.name === 'Bills')!;
		expect(() =>
			saveCategoryOrder(db, [{ groupId: income.id, categoryIds: [categoryId(db, 'Food')] }])
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
		expect(() =>
			saveCategoryOrder(db, [{ groupId: bills.id, categoryIds: [income.categories[0].id] }])
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});
});
