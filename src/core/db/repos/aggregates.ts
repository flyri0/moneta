import type {
	CategoryKind,
	EngineAssignment,
	EngineEntry,
	EngineInput
} from '$domain/budget-engine';
import { all, type Db } from '../connection';

/** Loads everything the budget engine needs. Off-budget accounts never contribute. */
export function loadEngineInput(db: Db): EngineInput {
	const categories = all<{
		id: string;
		groupSystem: string | null;
		carryover: number;
	}>(
		db,
		`SELECT c.id, g.system AS groupSystem, c.carryover_overspending AS carryover
		 FROM categories c
		 JOIN category_groups g ON g.id = c.group_id`
	).map((c) => ({
		id: c.id,
		kind: (c.groupSystem === 'income' ? 'income' : 'regular') as CategoryKind,
		carryoverOverspending: c.carryover === 1
	}));

	// Summed per month and category here: the engine only ever adds them up.
	const entries = all<EngineEntry>(
		db,
		`SELECT categoryId, month, SUM(amount) AS amount FROM (
			SELECT t.category_id AS categoryId, substr(t.date, 1, 7) AS month, t.amount
			FROM transactions t JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.is_split = 0 AND t.category_id IS NOT NULL
			UNION ALL
			SELECT s.category_id, substr(t.date, 1, 7), s.amount
			FROM transaction_splits s
			JOIN transactions t ON t.id = s.transaction_id
			JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1
		 )
		 GROUP BY categoryId, month`
	);

	const assignments = all<EngineAssignment>(
		db,
		'SELECT category_id AS categoryId, month, assigned FROM budget_assignments'
	);

	return { categories, entries, assignments };
}
