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
	ccAccountId: string | null;
	system: 'ready_to_assign' | null;
}

export interface GroupNode {
	id: string;
	name: string;
	sortOrder: number;
	hidden: boolean;
	system: 'income' | 'credit_card_payments' | null;
	categories: CategoryNode[];
}

interface CategoryRow {
	id: string;
	groupId: string;
	name: string;
	sortOrder: number;
	hidden: number;
	carryoverOverspending: number;
	ccAccountId: string | null;
	system: 'ready_to_assign' | null;
}

interface GroupRow {
	id: string;
	name: string;
	sortOrder: number;
	hidden: number;
	system: GroupNode['system'];
}

const CATEGORY_COLUMNS = `id, group_id AS groupId, name, sort_order AS sortOrder, hidden,
	carryover_overspending AS carryoverOverspending, cc_account_id AS ccAccountId, system`;

function toCategory(r: CategoryRow): CategoryNode {
	return { ...r, hidden: r.hidden === 1, carryoverOverspending: r.carryoverOverspending === 1 };
}

export function getCategory(db: Db, id: string): CategoryNode {
	const row = one<CategoryRow>(db, `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`, [id]);
	if (!row) throw new DomainError('NOT_FOUND', `Category ${id} not found`);
	return toCategory(row);
}

function getGroup(db: Db, id: string): GroupRow {
	const row = one<GroupRow>(
		db,
		'SELECT id, name, sort_order AS sortOrder, hidden, system FROM category_groups WHERE id = ?',
		[id]
	);
	if (!row) throw new DomainError('NOT_FOUND', `Group ${id} not found`);
	return row;
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

export function deleteGroup(db: Db, id: string): void {
	tx(db, () => {
		const group = getGroup(db, id);
		if (group.system) throw new DomainError('SYSTEM_ENTITY_READONLY');
		if (one(db, 'SELECT 1 AS x FROM categories WHERE group_id = ?', [id]))
			throw new DomainError('GROUP_NOT_EMPTY');
		run(db, 'DELETE FROM category_groups WHERE id = ?', [id]);
	});
}

export function createCategory(db: Db, input: { groupId: string; name: string }): string {
	return tx(db, () => {
		const group = getGroup(db, input.groupId);
		if (group.system) throw new DomainError('SYSTEM_ENTITY_READONLY');
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
		if (category.system) throw new DomainError('SYSTEM_ENTITY_READONLY');
		if (
			category.ccAccountId &&
			(patch.name !== undefined || patch.groupId !== undefined || patch.hidden !== undefined)
		) {
			throw new DomainError('SYSTEM_ENTITY_READONLY', 'Card payment categories follow their card');
		}
		if (patch.name !== undefined)
			run(db, 'UPDATE categories SET name = ? WHERE id = ?', [requireName(patch.name), id]);
		if (patch.groupId !== undefined) {
			if (getGroup(db, patch.groupId).system) throw new DomainError('SYSTEM_ENTITY_READONLY');
			run(db, 'UPDATE categories SET group_id = ? WHERE id = ?', [patch.groupId, id]);
		}
		if (patch.hidden !== undefined)
			run(db, 'UPDATE categories SET hidden = ? WHERE id = ?', [patch.hidden ? 1 : 0, id]);
		if (patch.carryoverOverspending !== undefined)
			run(db, 'UPDATE categories SET carryover_overspending = ? WHERE id = ?', [
				patch.carryoverOverspending ? 1 : 0,
				id
			]);
	});
}

/**
 * Deletes a regular category. If transactions, splits, or assignments use it,
 * `reassignTo` (another regular category) must be given; everything moves there.
 */
export function deleteCategory(db: Db, id: string, reassignTo?: string): void {
	tx(db, () => {
		const category = getCategory(db, id);
		if (category.system || category.ccAccountId) throw new DomainError('SYSTEM_ENTITY_READONLY');
		const used =
			one(db, 'SELECT 1 AS x FROM transactions WHERE category_id = ?', [id]) ||
			one(db, 'SELECT 1 AS x FROM transaction_splits WHERE category_id = ?', [id]) ||
			one(db, 'SELECT 1 AS x FROM budget_assignments WHERE category_id = ?', [id]);
		if (used) {
			if (!reassignTo || reassignTo === id) throw new DomainError('REASSIGN_REQUIRED');
			const target = getCategory(db, reassignTo);
			if (target.system || target.ccAccountId) throw new DomainError('CATEGORY_NOT_ALLOWED');
			run(db, 'UPDATE transactions SET category_id = ? WHERE category_id = ?', [reassignTo, id]);
			run(db, 'UPDATE transaction_splits SET category_id = ? WHERE category_id = ?', [
				reassignTo,
				id
			]);
			run(
				db,
				`INSERT INTO budget_assignments (category_id, month, assigned)
				 SELECT ?, month, assigned FROM budget_assignments WHERE category_id = ?
				 ON CONFLICT (category_id, month) DO UPDATE SET assigned = assigned + excluded.assigned`,
				[reassignTo, id]
			);
		}
		run(db, 'DELETE FROM categories WHERE id = ?', [id]);
	});
}

/** System groups keep these positions; user groups follow in the order saved. */
const SYSTEM_GROUP_ORDER = { income: 0, credit_card_payments: 1 } as const;

/** Persists drag-and-drop order: group order, category order and group membership. */
export function saveCategoryOrder(
	db: Db,
	layout: { groupId: string; categoryIds: string[] }[]
): void {
	tx(db, () => {
		let nextUserOrder = Object.keys(SYSTEM_GROUP_ORDER).length;
		layout.forEach((entry) => {
			const group = getGroup(db, entry.groupId);
			const order = group.system ? SYSTEM_GROUP_ORDER[group.system] : nextUserOrder++;
			run(db, 'UPDATE category_groups SET sort_order = ? WHERE id = ?', [order, entry.groupId]);
			entry.categoryIds.forEach((categoryId, ci) => {
				const category = getCategory(db, categoryId);
				const moving = category.groupId !== entry.groupId;
				if (moving && (group.system || category.system || category.ccAccountId)) {
					throw new DomainError('SYSTEM_ENTITY_READONLY');
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
