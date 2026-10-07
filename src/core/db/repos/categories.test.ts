import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, run } from '../connection';
import { createRule, listRules } from './payee-rules';
import {
	categoryUsage,
	createCategory,
	createCategoryIn,
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

	it('moves the categories of a deleted group to the end of another group', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		const bills = tree.find((g) => g.name === 'Bills')!;
		const everyday = tree.find((g) => g.name === 'Everyday')!;
		deleteGroup(db, bills.id, everyday.id);
		const after = listCategoryTree(db);
		expect(after.some((g) => g.id === bills.id)).toBe(false);
		expect(after.find((g) => g.id === everyday.id)!.categories.map((c) => c.name)).toEqual([
			'Food',
			'Fun',
			'Rent',
			'Utilities'
		]);
	});

	it('refuses to move a deleted group’s categories into a system group or itself', async () => {
		const db = await createBudgetDb();
		const tree = listCategoryTree(db);
		const bills = tree.find((g) => g.name === 'Bills')!;
		const income = tree.find((g) => g.system === 'income')!;
		expect(() => deleteGroup(db, bills.id, income.id)).toThrow(code('SYSTEM_ENTITY_READONLY'));
		expect(() => deleteGroup(db, bills.id, bills.id)).toThrow(code('GROUP_NOT_EMPTY'));
		expect(listCategoryTree(db).find((g) => g.id === bills.id)!.categories).toHaveLength(2);
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

	it('sets, changes and removes a goal', async () => {
		const db = await createBudgetDb();
		const rent = categoryId(db, 'Rent');
		expect(getCategory(db, rent).goal).toBeNull();

		updateCategory(db, rent, { goal: { type: 'monthly', amount: 120000, month: null } });
		expect(getCategory(db, rent).goal).toEqual({ type: 'monthly', amount: 120000, month: null });

		updateCategory(db, rent, { goal: { type: 'target', amount: 500000, month: '2026-12' } });
		expect(getCategory(db, rent).goal).toEqual({
			type: 'target',
			amount: 500000,
			month: '2026-12'
		});
		expect(
			listCategoryTree(db)
				.flatMap((g) => g.categories)
				.find((c) => c.id === rent)!.goal
		).toMatchObject({ type: 'target' });

		updateCategory(db, rent, { goal: null });
		expect(getCategory(db, rent).goal).toBeNull();
	});

	it('refuses a goal that makes no sense', async () => {
		const db = await createBudgetDb();
		const rent = categoryId(db, 'Rent');
		const bad = [
			{ type: 'weekly', amount: 100, month: null },
			{ type: 'monthly', amount: 0, month: null },
			{ type: 'monthly', amount: -100, month: null },
			{ type: 'monthly', amount: 10.5, month: null },
			{ type: 'monthly', amount: 100, month: '2026-12' },
			{ type: 'target', amount: 100, month: '2026-13' }
		];
		for (const goal of bad)
			expect(() => updateCategory(db, rent, { goal } as never)).toThrow(code('INVALID_INPUT'));
		expect(getCategory(db, rent).goal).toBeNull();
	});

	it('disallows goals on categories in the Income group', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		const salary = income.categories[0].id;
		expect(() =>
			updateCategory(db, salary, { goal: { type: 'monthly', amount: 100, month: null } })
		).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});

	it('reports how a category is used', async () => {
		const db = await createBudgetDb();
		const fun = categoryId(db, 'Fun');
		expect(categoryUsage(db, fun)).toEqual({ transactions: 0, used: false });

		run(db, 'INSERT INTO budget_assignments (category_id, month, assigned) VALUES (?, ?, ?)', [
			fun,
			'2026-01',
			3000
		]);
		expect(categoryUsage(db, fun)).toEqual({ transactions: 0, used: true });

		run(
			db,
			"INSERT INTO accounts (id, name, type, on_budget, sort_order, created_at) VALUES ('acc1', 'Bank', 'checking', 1, 0, '2026-01-01T00:00:00Z')"
		);
		const txn =
			'INSERT INTO transactions (id, account_id, date, amount, category_id) VALUES (?, ?, ?, ?, ?)';
		run(db, txn, ['tx1', 'acc1', '2026-01-05', -1000, fun]);
		run(db, txn, ['tx2', 'acc1', '2026-01-06', -900, null]);
		const split =
			'INSERT INTO transaction_splits (id, transaction_id, category_id, amount) VALUES (?, ?, ?, ?)';
		// Two splits of one transaction count once.
		run(db, split, ['s1', 'tx2', fun, -400]);
		run(db, split, ['s2', 'tx2', fun, -500]);
		expect(categoryUsage(db, fun)).toEqual({ transactions: 2, used: true });
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

	it('moves payee defaults with a reassignment and clears them otherwise', async () => {
		const db = await createBudgetDb();
		const food = categoryId(db, 'Food');
		const fun = categoryId(db, 'Fun');
		const rent = categoryId(db, 'Rent');
		run(
			db,
			"INSERT INTO accounts (id, name, type, on_budget, sort_order, created_at) VALUES ('acc1', 'Bank', 'checking', 1, 0, '2026-01-01T00:00:00Z')"
		);
		run(
			db,
			'INSERT INTO transactions (id, account_id, date, amount, category_id) VALUES (?, ?, ?, ?, ?)',
			['tx1', 'acc1', '2026-01-05', -1000, fun]
		);
		const payee = 'INSERT INTO payees (id, name, default_category_id) VALUES (?, ?, ?)';
		run(db, payee, ['p1', 'Cinema', fun]);
		run(db, payee, ['p2', 'Landlord', rent]);

		deleteCategory(db, fun, food);
		deleteCategory(db, rent);

		expect(all(db, 'SELECT id, default_category_id AS c FROM payees ORDER BY id')).toEqual([
			{ id: 'p1', c: food },
			{ id: 'p2', c: null }
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

	it('saves the Income group wherever it is placed', async () => {
		const db = await createBudgetDb();
		const [income, bills, everyday] = listCategoryTree(db);
		saveCategoryOrder(
			db,
			[everyday, bills, income].map((g) => ({
				groupId: g.id,
				categoryIds: g.categories.map((c) => c.id)
			}))
		);
		expect(listCategoryTree(db).map((g) => g.name)).toEqual(['Everyday', 'Bills', 'Income']);
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

describe('icons', () => {
	it('sets and removes a group icon', async () => {
		const db = await createBudgetDb();
		const id = createGroup(db, { name: 'Food' });
		expect(listCategoryTree(db).find((g) => g.id === id)!.icon).toBeNull();
		updateGroup(db, id, { icon: '🍕' });
		expect(listCategoryTree(db).find((g) => g.id === id)!.icon).toBe('🍕');
		updateGroup(db, id, { icon: null });
		expect(listCategoryTree(db).find((g) => g.id === id)!.icon).toBeNull();
	});

	it('sets and removes a category icon, ZWJ sequences and flags included', async () => {
		const db = await createBudgetDb();
		const id = categoryId(db, 'Rent');
		updateCategory(db, id, { icon: '🧑🏽‍🍳' });
		expect(getCategory(db, id).icon).toBe('🧑🏽‍🍳');
		updateCategory(db, id, { icon: '🇧🇷' });
		expect(getCategory(db, id).icon).toBe('🇧🇷');
		updateCategory(db, id, { icon: null });
		expect(getCategory(db, id).icon).toBeNull();
	});

	it('refuses an icon that is not one emoji', async () => {
		const db = await createBudgetDb();
		const id = categoryId(db, 'Rent');
		expect(() => updateCategory(db, id, { icon: 'food' })).toThrow(code('INVALID_INPUT'));
		expect(() => updateCategory(db, id, { icon: '🍕🍔' })).toThrow(code('INVALID_INPUT'));
		expect(() => updateCategory(db, id, { icon: '' })).toThrow(code('INVALID_INPUT'));
		expect(getCategory(db, id).icon).toBeNull();
	});
});

describe('createCategoryIn', () => {
	it('adds a category to an existing group', async () => {
		const db = await createBudgetDb();
		const bills = listCategoryTree(db).find((g) => g.name === 'Bills')!;
		const { categoryId: id, groupId } = createCategoryIn(db, {
			name: ' Internet ',
			group: { id: bills.id }
		});
		expect(groupId).toBe(bills.id);
		expect(getCategory(db, id)).toMatchObject({ name: 'Internet', groupId: bills.id });
	});

	it('creates the group first when given a name', async () => {
		const db = await createBudgetDb();
		const { categoryId: id, groupId } = createCategoryIn(db, {
			name: 'Vet',
			group: { name: 'Pets' }
		});
		const group = listCategoryTree(db).find((g) => g.id === groupId)!;
		expect(group).toMatchObject({ name: 'Pets', categories: [{ id, name: 'Vet' }] });
	});

	it('adds to the income group', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		const { categoryId: id } = createCategoryIn(db, { name: 'Bonus', group: { id: income.id } });
		expect(getCategory(db, id).groupId).toBe(income.id);
	});

	it('creates nothing when the category has no name', async () => {
		const db = await createBudgetDb();
		const before = listCategoryTree(db).length;
		expect(() => createCategoryIn(db, { name: ' ', group: { name: 'Pets' } })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(listCategoryTree(db)).toHaveLength(before);
	});
});

/** Gives a category money in January, which makes it one to reassign. */
function assignSome(db: Parameters<typeof run>[0], id: string) {
	run(
		db,
		"INSERT INTO budget_assignments (category_id, month, assigned) VALUES (?, '2026-01', 100)",
		[id]
	);
}

describe('deleting a category used by payee rules', () => {
	it('moves the rules to the category that takes its place', async () => {
		const db = await createBudgetDb();
		const food = categoryId(db, 'Food');
		const fun = categoryId(db, 'Fun');
		createRule(db, { payeeName: 'Uber', kind: 'starts', text: 'UBER', categoryId: food });
		assignSome(db, food);
		deleteCategory(db, food, fun);
		expect(listRules(db)[0].categoryId).toBe(fun);
	});

	it("leaves the payee's usual category when an unused category goes", async () => {
		const db = await createBudgetDb();
		const food = categoryId(db, 'Food');
		createRule(db, { payeeName: 'Uber', kind: 'starts', text: 'UBER', categoryId: food });
		deleteCategory(db, food);
		expect(listRules(db)[0].categoryId).toBeNull();
	});
});
