import { uuidv7 } from 'uuidv7';
import { all, one, run, type Db } from '../connection';

export interface Payee {
	id: string;
	name: string;
	lastCategoryId: string | null; // category of the most recent non-split, non-transfer transaction
}

export function listPayees(db: Db): Payee[] {
	return all<Payee>(
		db,
		`SELECT p.id, p.name,
			(SELECT t.category_id FROM transactions t
			 WHERE t.payee_id = p.id AND t.is_split = 0 AND t.transfer_id IS NULL AND t.category_id IS NOT NULL
			 ORDER BY t.date DESC, t.id DESC LIMIT 1) AS lastCategoryId
		 FROM payees p ORDER BY p.name COLLATE NOCASE`
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
