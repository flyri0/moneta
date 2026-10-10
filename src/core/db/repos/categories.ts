import { uuidv7 } from 'uuidv7';
import { DomainError } from '$domain/errors';
import { validateIcon } from '$domain/icon';
import { GOAL_TYPES, type CategoryGoal } from '$domain/goal';
import { isMonth } from '$domain/month';
import { groupBy } from '$domain/group-by';
import { all, one, run, tx, type Db } from '../connection';

export interface CategoryNode {
	id: string;
	groupId: string;
	name: string;
	/** An emoji, or null. */
	icon: string | null;
	sortOrder: number;
	hidden: boolean;
	carryoverOverspending: boolean;
	goal: CategoryGoal | null;
}

export interface GroupNode {
	id: string;
	name: string;
	/** An emoji, or null. */
	icon: string | null;
	sortOrder: number;
	hidden: boolean;
	system: 'income' | null;
	categories: CategoryNode[];
}

interface CategoryRow {
	id: string;
	groupId: string;
	name: string;
	icon: string | null;
	sortOrder: number;
	hidden: number;
	carryoverOverspending: number;
	goalType: CategoryGoal['type'] | null;
	goalAmount: number | null;
	goalMonth: string | null;
}

interface GroupRow {
	id: string;
	name: string;
	icon: string | null;
	sortOrder: number;
	hidden: number;
	system: GroupNode['system'];
}

const CATEGORY_COLUMNS = `id, group_id AS groupId, name, icon, sort_order AS sortOrder, hidden,
	carryover_overspending AS carryoverOverspending, goal_type AS goalType,
	goal_amount AS goalAmount, goal_month AS goalMonth`;

function toCategory({ goalType, goalAmount, goalMonth, ...r }: CategoryRow): CategoryNode {
	return {
		...r,
		hidden: r.hidden === 1,
		carryoverOverspending: r.carryoverOverspending === 1,
		goal:
			goalType === null || goalAmount === null
				? null
				: { type: goalType, amount: goalAmount, month: goalMonth }
	};
}

export function getCategory(db: Db, id: string): CategoryNode {
	const row = one<CategoryRow>(db, `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`, [id]);
	if (!row) throw new DomainError('NOT_FOUND', `Category ${id} not found`);
	return toCategory(row);
}

export interface GroupRecord {
	id: string;
	name: string;
	icon: string | null;
	sortOrder: number;
	hidden: boolean;
	system: GroupNode['system'];
}

function toGroup(r: GroupRow): GroupRecord {
	return { ...r, hidden: r.hidden === 1 };
}

export function getGroup(db: Db, id: string): GroupRecord {
	const row = one<GroupRow>(
		db,
		'SELECT id, name, icon, sort_order AS sortOrder, hidden, system FROM category_groups WHERE id = ?',
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Group ${id} not found`);
	return toGroup(row);
}

export function listCategoryTree(db: Db): GroupNode[] {
	const groups = all<GroupRow>(
		db,
		'SELECT id, name, icon, sort_order AS sortOrder, hidden, system FROM category_groups ORDER BY sort_order, name'
	);
	const categories = all<CategoryRow>(
		db,
		`SELECT ${CATEGORY_COLUMNS} FROM categories ORDER BY sort_order, name`
	).map(toCategory);
	const byGroup = groupBy(categories, (c) => c.groupId);
	return groups.map((g) => ({
		...g,
		hidden: g.hidden === 1,
		categories: byGroup.get(g.id) ?? []
	}));
}

function requireName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) throw new DomainError('INVALID_INPUT', 'Name is required');
	return trimmed;
}

/** The Income group's label in each language the app speaks: no other group may take it. */
export const INCOME_GROUP_NAMES: readonly string[] = ['Income', 'Receitas'];

const sameName = (a: string, b: string) =>
	a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** `name`, trimmed, unless another group (or the Income group's label) already has it. */
function requireFreeGroupName(db: Db, name: string, exceptId?: string): string {
	const trimmed = requireName(name);
	const groups = all<{ id: string; name: string }>(db, 'SELECT id, name FROM category_groups');
	if (
		INCOME_GROUP_NAMES.some((n) => sameName(n, trimmed)) ||
		groups.some((g) => g.id !== exceptId && sameName(g.name, trimmed))
	)
		throw new DomainError('NAME_EXISTS');
	return trimmed;
}

/** `name`, trimmed, unless another category in `groupId` already has it. */
function requireFreeCategoryName(db: Db, groupId: string, name: string, exceptId?: string): string {
	const trimmed = requireName(name);
	const siblings = all<{ id: string; name: string }>(
		db,
		'SELECT id, name FROM categories WHERE group_id = ?',
		[groupId]
	);
	if (siblings.some((c) => c.id !== exceptId && sameName(c.name, trimmed)))
		throw new DomainError('NAME_EXISTS');
	return trimmed;
}

/** The id of the user group named `name`, if any. */
function groupNamed(db: Db, name: string): string | null {
	const groups = all<{ id: string; name: string }>(
		db,
		'SELECT id, name FROM category_groups WHERE system IS NULL'
	);
	return groups.find((g) => sameName(g.name, name))?.id ?? null;
}

/** The id of the category named `name` in `groupId`, if any. */
function categoryNamed(db: Db, groupId: string, name: string): string | null {
	const categories = all<{ id: string; name: string }>(
		db,
		'SELECT id, name FROM categories WHERE group_id = ?',
		[groupId]
	);
	return categories.find((c) => sameName(c.name, name))?.id ?? null;
}

export function createGroup(db: Db, input: { name: string }): string {
	const id = uuidv7();
	run(
		db,
		'INSERT INTO category_groups (id, name, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM category_groups))',
		[id, requireFreeGroupName(db, input.name)]
	);
	return id;
}

export interface GroupPatch {
	name?: string;
	hidden?: boolean;
	/** An emoji; `null` removes it. */
	icon?: string | null;
}

export function updateGroup(db: Db, id: string, patch: GroupPatch): void {
	tx(db, () => {
		const group = getGroup(db, id);
		// A system group keeps its name and stays visible; only its icon changes.
		if (group.system && (patch.name !== undefined || patch.hidden !== undefined))
			throw new DomainError('SYSTEM_ENTITY_READONLY');
		if (patch.name !== undefined)
			run(db, 'UPDATE category_groups SET name = ? WHERE id = ?', [
				requireFreeGroupName(db, patch.name, id),
				id
			]);
		if (patch.hidden !== undefined)
			run(db, 'UPDATE category_groups SET hidden = ? WHERE id = ?', [patch.hidden ? 1 : 0, id]);
		if (patch.icon !== undefined)
			run(db, 'UPDATE category_groups SET icon = ? WHERE id = ?', [validateIcon(patch.icon), id]);
	});
}

/**
 * Deletes a user group. A group with categories needs `moveTo`, another user group: its
 * categories move to the end of that group, in their order.
 */
export function deleteGroup(db: Db, id: string, moveTo?: string): void {
	tx(db, () => {
		const group = getGroup(db, id);
		if (group.system) throw new DomainError('SYSTEM_ENTITY_READONLY');
		if (one(db, 'SELECT 1 AS x FROM categories WHERE group_id = ?', [id])) {
			if (!moveTo || moveTo === id) throw new DomainError('GROUP_NOT_EMPTY');
			if (getGroup(db, moveTo).system) throw new DomainError('SYSTEM_ENTITY_READONLY');
			const base = one<{ next: number }>(
				db,
				'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories WHERE group_id = ?',
				[moveTo]
			)!.next;
			run(
				db,
				'UPDATE categories SET group_id = ?, sort_order = sort_order + ? WHERE group_id = ?',
				[moveTo, base, id]
			);
		}
		run(db, 'DELETE FROM category_groups WHERE id = ?', [id]);
	});
}

export function createCategory(db: Db, input: { groupId: string; name: string }): string {
	return tx(db, () => {
		const group = getGroup(db, input.groupId);
		if (group.system && group.system !== 'income') throw new DomainError('SYSTEM_ENTITY_READONLY');
		const id = uuidv7();
		run(
			db,
			'INSERT INTO categories (id, group_id, name, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories WHERE group_id = ?))',
			[id, input.groupId, requireFreeCategoryName(db, input.groupId, input.name), input.groupId]
		);
		return id;
	});
}

/**
 * Creates a category in an existing group (`{ id }`) or in a new one (`{ name }`), all or nothing.
 * A group or a category with that name already there is used instead.
 */
export function createCategoryIn(
	db: Db,
	input: { name: string; group: { id: string } | { name: string } }
): { categoryId: string; groupId: string } {
	return tx(db, () => {
		const group = input.group;
		const groupId =
			'id' in group
				? group.id
				: (groupNamed(db, group.name) ?? createGroup(db, { name: group.name }));
		const categoryId =
			categoryNamed(db, groupId, input.name) ?? createCategory(db, { groupId, name: input.name });
		return { categoryId, groupId };
	});
}

export interface CategoryPatch {
	name?: string;
	groupId?: string;
	hidden?: boolean;
	/** An emoji; `null` removes it. */
	icon?: string | null;
	carryoverOverspending?: boolean;
	/** `null` removes the goal. */
	goal?: CategoryGoal | null;
}

function requireGoal(goal: CategoryGoal): void {
	if (!GOAL_TYPES.includes(goal.type))
		throw new DomainError('INVALID_INPUT', `Unknown goal type ${goal.type}`);
	if (!Number.isSafeInteger(goal.amount) || goal.amount <= 0)
		throw new DomainError('INVALID_INPUT', 'A goal needs a positive amount');
	if (goal.month !== null && (goal.type !== 'target' || !isMonth(goal.month)))
		throw new DomainError('INVALID_INPUT', `Invalid goal month ${goal.month}`);
}

export function updateCategory(db: Db, id: string, patch: CategoryPatch): void {
	tx(db, () => {
		const category = getCategory(db, id);
		const currentGroup = getGroup(db, category.groupId);
		const moving = patch.groupId !== undefined && patch.groupId !== category.groupId;
		if (patch.name !== undefined || moving)
			requireFreeCategoryName(
				db,
				moving ? patch.groupId! : category.groupId,
				patch.name ?? category.name,
				id
			);

		if (patch.name !== undefined)
			run(db, 'UPDATE categories SET name = ? WHERE id = ?', [requireName(patch.name), id]);

		if (patch.groupId !== undefined && patch.groupId !== category.groupId) {
			const targetGroup = getGroup(db, patch.groupId);
			if ((currentGroup.system === 'income') !== (targetGroup.system === 'income')) {
				throw new DomainError('CATEGORY_NOT_ALLOWED');
			}
			if (targetGroup.system && targetGroup.system !== 'income') {
				throw new DomainError('CATEGORY_NOT_ALLOWED');
			}
			run(db, 'UPDATE categories SET group_id = ? WHERE id = ?', [patch.groupId, id]);
		}

		if (patch.hidden !== undefined)
			run(db, 'UPDATE categories SET hidden = ? WHERE id = ?', [patch.hidden ? 1 : 0, id]);

		if (patch.icon !== undefined)
			run(db, 'UPDATE categories SET icon = ? WHERE id = ?', [validateIcon(patch.icon), id]);

		if (patch.carryoverOverspending !== undefined) {
			const effectiveGroup =
				patch.groupId !== undefined ? getGroup(db, patch.groupId) : currentGroup;
			if (patch.carryoverOverspending && effectiveGroup.system === 'income') {
				throw new DomainError(
					'CATEGORY_NOT_ALLOWED',
					'Income categories cannot carry over overspending'
				);
			}
			run(db, 'UPDATE categories SET carryover_overspending = ? WHERE id = ?', [
				patch.carryoverOverspending ? 1 : 0,
				id
			]);
		}

		if (patch.goal !== undefined) {
			const goal = patch.goal;
			if (goal) {
				requireGoal(goal);
				const effectiveGroup =
					patch.groupId !== undefined ? getGroup(db, patch.groupId) : currentGroup;
				if (effectiveGroup.system === 'income')
					throw new DomainError('CATEGORY_NOT_ALLOWED', 'Income categories cannot have a goal');
			}
			run(db, 'UPDATE categories SET goal_type = ?, goal_amount = ?, goal_month = ? WHERE id = ?', [
				goal?.type ?? null,
				goal?.amount ?? null,
				goal?.month ?? null,
				id
			]);
		}
	});
}

export interface CategoryUsage {
	/** Transactions filed under the category, directly or through a split. */
	transactions: number;
	/** Schedules that use it, directly or in a split. */
	schedules: number;
	/**
	 * Whether a transaction, a split, an assignment or a schedule uses it: deleting it then needs a
	 * target.
	 */
	used: boolean;
}

/** How a category is used, shown before deleting it. */
export function categoryUsage(db: Db, id: string): CategoryUsage {
	const transactions =
		one<{ n: number }>(
			db,
			`SELECT COUNT(*) AS n FROM transactions t
			 WHERE t.category_id = ?
			    OR EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id AND s.category_id = ?)`,
			[id, id]
		)?.n ?? 0;
	const schedules =
		one<{ n: number }>(
			db,
			`SELECT COUNT(*) AS n FROM schedules sc
			 WHERE sc.category_id = ?
			    OR EXISTS (SELECT 1 FROM schedule_splits s WHERE s.schedule_id = sc.id AND s.category_id = ?)`,
			[id, id]
		)?.n ?? 0;
	const assigned = one(db, 'SELECT 1 AS x FROM budget_assignments WHERE category_id = ?', [id]);
	return {
		transactions,
		schedules,
		used: transactions > 0 || schedules > 0 || assigned !== undefined
	};
}

/**
 * Deletes a category. If transactions, splits, or assignments use it,
 * `reassignTo` (a category of the same kind) must be given; everything moves there.
 */
export function deleteCategory(db: Db, id: string, reassignTo?: string): void {
	tx(db, () => {
		const category = getCategory(db, id);
		const group = getGroup(db, category.groupId);
		if (categoryUsage(db, id).used) {
			if (!reassignTo || reassignTo === id) throw new DomainError('REASSIGN_REQUIRED');
			const target = getCategory(db, reassignTo);
			const targetGroup = getGroup(db, target.groupId);
			if ((group.system === 'income') !== (targetGroup.system === 'income')) {
				throw new DomainError('CATEGORY_NOT_ALLOWED');
			}
			if (targetGroup.system && targetGroup.system !== 'income') {
				throw new DomainError('CATEGORY_NOT_ALLOWED');
			}
			run(db, 'UPDATE transactions SET category_id = ? WHERE category_id = ?', [reassignTo, id]);
			run(db, 'UPDATE transaction_splits SET category_id = ? WHERE category_id = ?', [
				reassignTo,
				id
			]);
			run(db, 'UPDATE schedules SET category_id = ? WHERE category_id = ?', [reassignTo, id]);
			run(db, 'UPDATE schedule_splits SET category_id = ? WHERE category_id = ?', [reassignTo, id]);
			run(
				db,
				`INSERT INTO budget_assignments (category_id, month, assigned)
				 SELECT ?, month, assigned FROM budget_assignments WHERE category_id = ?
				 ON CONFLICT (category_id, month) DO UPDATE SET assigned = assigned + excluded.assigned`,
				[reassignTo, id]
			);
			run(db, 'UPDATE payee_rules SET category_id = ? WHERE category_id = ?', [reassignTo, id]);
			run(db, 'UPDATE payees SET default_category_id = ? WHERE default_category_id = ?', [
				reassignTo,
				id
			]);
		}
		run(db, 'DELETE FROM categories WHERE id = ?', [id]);
	});
}

/**
 * Persists drag-and-drop order: group order (the Income group included), category order and
 * group membership. Categories never move between the Income group and user groups.
 */
export function saveCategoryOrder(
	db: Db,
	layout: { groupId: string; categoryIds: string[] }[]
): void {
	tx(db, () => {
		const moved: string[] = [];
		layout.forEach((entry, order) => {
			const group = getGroup(db, entry.groupId);
			run(db, 'UPDATE category_groups SET sort_order = ? WHERE id = ?', [order, entry.groupId]);
			entry.categoryIds.forEach((categoryId, ci) => {
				const category = getCategory(db, categoryId);
				const moving = category.groupId !== entry.groupId;
				if (moving) {
					moved.push(categoryId);
					const sourceGroup = getGroup(db, category.groupId);
					if ((sourceGroup.system === 'income') !== (group.system === 'income')) {
						throw new DomainError('CATEGORY_NOT_ALLOWED');
					}
					if (group.system && group.system !== 'income') {
						throw new DomainError('CATEGORY_NOT_ALLOWED');
					}
				}
				run(db, 'UPDATE categories SET group_id = ?, sort_order = ? WHERE id = ?', [
					entry.groupId,
					ci,
					categoryId
				]);
			});
		});
		// Checked once everything is in place, so a swap between groups isn't refused half-way.
		for (const id of moved) {
			const c = getCategory(db, id);
			requireFreeCategoryName(db, c.groupId, c.name, id);
		}
	});
}
