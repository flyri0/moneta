import { uuidv7 } from 'uuidv7';
import { DomainError } from '$domain/errors';
import { all, one, run, tx, type Db } from '../connection';

export interface Payee {
	id: string;
	name: string;
	/** The category chosen for this payee's new transactions, if any. */
	defaultCategoryId: string | null;
	lastCategoryId: string | null; // category of the most recent non-split, non-transfer transaction
	/** How many transactions use this payee. */
	transactions: number;
	/** How many schedules use this payee. */
	schedules: number;
	/** The date of its most recent transaction. */
	lastUsed: string | null;
}

export function listPayees(db: Db): Payee[] {
	return all<Payee>(
		db,
		`SELECT p.id, p.name, p.default_category_id AS defaultCategoryId,
			(SELECT t.category_id FROM transactions t
			 WHERE t.payee_id = p.id AND t.is_split = 0 AND t.transfer_id IS NULL AND t.category_id IS NOT NULL
			 ORDER BY t.date DESC, t.id DESC LIMIT 1) AS lastCategoryId,
			COALESCE(u.n, 0) AS transactions, u.lastUsed,
			(SELECT COUNT(*) FROM schedules s WHERE s.payee_id = p.id) AS schedules
		 FROM payees p
		 LEFT JOIN (SELECT payee_id, COUNT(*) AS n, MAX(date) AS lastUsed
			FROM transactions WHERE payee_id IS NOT NULL GROUP BY payee_id) u ON u.payee_id = p.id
		 ORDER BY p.name COLLATE NOCASE`
	);
}

/** Returns the id of the payee named `name` (case-insensitive), creating it if needed. */
export function getOrCreatePayee(db: Db, name: string | null | undefined): string | null {
	const trimmed = name?.trim();
	if (!trimmed) return null;
	const existing = one<{ id: string }>(db, 'SELECT id FROM payees WHERE name = ?', [trimmed]);
	if (existing) return existing.id;
	const id = uuidv7();
	run(db, 'INSERT INTO payees (id, name) VALUES (?, ?)', [id, trimmed]);
	return id;
}

interface PayeeRow {
	id: string;
	name: string;
	defaultCategoryId: string | null;
}

/** The payee `id`, which must exist. */
function getPayee(db: Db, id: string): PayeeRow {
	const payee = one<PayeeRow>(
		db,
		'SELECT id, name, default_category_id AS defaultCategoryId FROM payees WHERE id = ?',
		[id]
	);
	if (!payee) throw new DomainError('NOT_FOUND', `Payee ${id} not found`);
	return payee;
}

function isUsed(db: Db, id: string): boolean {
	return (
		one(
			db,
			`SELECT 1 AS x FROM transactions WHERE payee_id = ?
			 UNION ALL SELECT 1 FROM schedules WHERE payee_id = ? LIMIT 1`,
			[id, id]
		) !== undefined
	);
}

/** Renames a payee, and so every transaction that uses it. */
export function renamePayee(db: Db, id: string, name: string): void {
	const trimmed = name.trim();
	if (!trimmed) throw new DomainError('INVALID_INPUT', 'Payee name is required');
	getPayee(db, id);
	if (one(db, 'SELECT 1 AS x FROM payees WHERE name = ? AND id <> ?', [trimmed, id]))
		throw new DomainError('PAYEE_EXISTS');
	run(db, 'UPDATE payees SET name = ? WHERE id = ?', [trimmed, id]);
}

/**
 * Moves every transaction of `sourceId` to `targetId` and deletes the source. The target keeps
 * its default category, or takes the source's when it has none.
 */
export function mergePayee(db: Db, sourceId: string, targetId: string): void {
	if (sourceId === targetId)
		throw new DomainError('INVALID_INPUT', 'Cannot merge a payee into itself');
	tx(db, () => {
		const source = getPayee(db, sourceId);
		const target = getPayee(db, targetId);
		run(db, 'UPDATE transactions SET payee_id = ? WHERE payee_id = ?', [targetId, sourceId]);
		run(db, 'UPDATE schedules SET payee_id = ? WHERE payee_id = ?', [targetId, sourceId]);
		if (!target.defaultCategoryId && source.defaultCategoryId)
			run(db, 'UPDATE payees SET default_category_id = ? WHERE id = ?', [
				source.defaultCategoryId,
				targetId
			]);
		run(db, 'DELETE FROM payees WHERE id = ?', [sourceId]);
	});
}

/** Sets the category a payee's new transactions start with, or clears it. */
export function setPayeeDefaultCategory(db: Db, id: string, categoryId?: string): void {
	getPayee(db, id);
	if (categoryId && !one(db, 'SELECT 1 AS x FROM categories WHERE id = ?', [categoryId]))
		throw new DomainError('NOT_FOUND', `Category ${categoryId} not found`);
	run(db, 'UPDATE payees SET default_category_id = ? WHERE id = ?', [categoryId || null, id]);
}

/** Deletes a payee no transaction uses. */
export function deletePayee(db: Db, id: string): void {
	getPayee(db, id);
	if (isUsed(db, id)) throw new DomainError('PAYEE_IN_USE');
	run(db, 'DELETE FROM payees WHERE id = ?', [id]);
}

/** Deletes every payee no transaction or schedule uses. Returns how many. */
export function deleteUnusedPayees(db: Db): number {
	return tx(db, () => {
		const unused = all<{ id: string }>(
			db,
			`SELECT id FROM payees p
			 WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.payee_id = p.id)
			   AND NOT EXISTS (SELECT 1 FROM schedules s WHERE s.payee_id = p.id)`
		);
		for (const p of unused) run(db, 'DELETE FROM payees WHERE id = ?', [p.id]);
		return unused.length;
	});
}
