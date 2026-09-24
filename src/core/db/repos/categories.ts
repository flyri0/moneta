import { uuidv7 } from 'uuidv7';
import { DomainError } from '$domain/errors';
import { all, one, run, tx, type Db } from '../connection';

export interface CategoryNode {
	id: string;
	groupId: string;
	name: string;
	sortOrder: number;
	hidden: boolean;
	carryoverOverspending: boolean;
}

export interface GroupNode {
	id: string;
	name: string;
	sortOrder: number;
	hidden: boolean;
	system: 'income' | null;
	categories: CategoryNode[];
}

interface CategoryRow {
	id: string;
	groupId: string;
	name: string;
	sortOrder: number;
	hidden: number;
	carryoverOverspending: number;
}

interface GroupRow {
	id: string;
	name: string;
	sortOrder: number;
	hidden: number;
	system: GroupNode['system'];
}

const CATEGORY_COLUMNS = `id, group_id AS groupId, name, sort_order AS sortOrder, hidden,
	carryover_overspending AS carryoverOverspending`;

function toCategory(r: CategoryRow): CategoryNode {
	return { ...r, hidden: r.hidden === 1, carryoverOverspending: r.carryoverOverspending === 1 };
}

export function getCategory(db: Db, id: string): CategoryNode {
	const row = one<CategoryRow>(db, `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`, [id]);
	if (!row) throw new DomainError('NOT_FOUND', `Category ${id} not found`);
	return toCategory(row);
}

export interface GroupRecord {
	id: string;
	name: string;
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
		'SELECT id, name, sort_order AS sortOrder, hidden, system FROM category_groups WHERE id = ?',
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Group ${id} not found`);
	return toGroup(row);
}

export function listCategoryTree(db: Db): GroupNode[] {
	const groups = all<GroupRow>(
		db,
		'SELECT id, name, sort_order AS sortOrder, hidden, system FROM category_groups ORDER BY sort_order, name'
	);
	const categories = all<CategoryRow>(
		db,
		`SELECT ${CATEGORY_COLUMNS} FROM categories ORDER BY sort_order, name`
	).map(toCategory);
	return groups.map((g) => ({
		...g,
		hidden: g.hidden === 1,
		categories: categories.filter((c) => c.groupId === g.id)
	}));
}

function requireName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) throw new DomainError('INVALID_INPUT', 'Name is required');
	return trimmed;
}

export function createGroup(db: Db, input: { name: string }): string {
	const id = uuidv7();
	run(
		db,
		'INSERT INTO category_groups (id, name, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM category_groups))',
		[id, requireName(input.name)]
	);
	return id;
}

export function updateGroup(db: Db, id: string, patch: { name?: string; hidden?: boolean }): void {
	tx(db, () => {
		const group = getGroup(db, id);
		if (group.system) throw new DomainError('SYSTEM_ENTITY_READONLY');
		if (patch.name !== undefined)
			run(db, 'UPDATE category_groups SET name = ? WHERE id = ?', [requireName(patch.name), id]);
		if (patch.hidden !== undefined)
			run(db, 'UPDATE category_groups SET hidden = ? WHERE id = ?', [patch.hidden ? 1 : 0, id]);
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
			[id, input.groupId, requireName(input.name), input.groupId]
		);
		return id;
	});
}

export interface CategoryPatch {
	name?: string;
	groupId?: string;
	hidden?: boolean;
	carryoverOverspending?: boolean;
}

export function updateCategory(db: Db, id: string, patch: CategoryPatch): void {
	tx(db, () => {
		const category = getCategory(db, id);
		const currentGroup = getGroup(db, category.groupId);

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
	});
}

export interface CategoryUsage {
	/** Transactions filed under the category, directly or through a split. */
	transactions: number;
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
	const assigned = one(db, 'SELECT 1 AS x FROM budget_assignments WHERE category_id = ?', [id]);
	const scheduled = one(
		db,
		`SELECT 1 AS x FROM schedules WHERE category_id = ?
		 UNION ALL SELECT 1 FROM schedule_splits WHERE category_id = ? LIMIT 1`,
		[id, id]
	);
	return {
		transactions,
		used: transactions > 0 || assigned !== undefined || scheduled !== undefined
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
		layout.forEach((entry, order) => {
			const group = getGroup(db, entry.groupId);
			run(db, 'UPDATE category_groups SET sort_order = ? WHERE id = ?', [order, entry.groupId]);
			entry.categoryIds.forEach((categoryId, ci) => {
				const category = getCategory(db, categoryId);
				const moving = category.groupId !== entry.groupId;
				if (moving) {
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
	});
}
