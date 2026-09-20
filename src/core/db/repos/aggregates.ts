import type {
	CategoryKind,
	EngineAssignment,
	EngineEntry,
	EngineInput,
	EnginePayment
} from '$domain/budget-engine';
import { all, type Db } from '../connection';

/** Loads everything the budget engine needs. Off-budget accounts never contribute. */
export function loadEngineInput(db: Db): EngineInput {
	const categories = all<{
		id: string;
		system: string | null;
		ccAccountId: string | null;
		carryover: number;
	}>(
		db,
		`SELECT id, system, cc_account_id AS ccAccountId, carryover_overspending AS carryover
		 FROM categories`
	).map((c) => ({
		id: c.id,
		kind: (c.system === 'ready_to_assign'
			? 'ready_to_assign'
			: c.ccAccountId
				? 'cc_payment'
				: 'regular') as CategoryKind,
		cardAccountId: c.ccAccountId,
		carryoverOverspending: c.carryover === 1
	}));

	const entries = all<EngineEntry>(
		db,
		`SELECT t.category_id AS categoryId, t.date, t.id AS "order", t.amount,
			CASE WHEN a.type = 'credit_card' THEN a.id END AS cardAccountId
		 FROM transactions t JOIN accounts a ON a.id = t.account_id
		 WHERE a.on_budget = 1 AND t.is_split = 0 AND t.category_id IS NOT NULL
		 UNION ALL
		 SELECT s.category_id, t.date, t.id || ':' || s.id, s.amount,
			CASE WHEN a.type = 'credit_card' THEN a.id END
		 FROM transaction_splits s
		 JOIN transactions t ON t.id = s.transaction_id
		 JOIN accounts a ON a.id = t.account_id
		 WHERE a.on_budget = 1`
	);

	const payments = all<EnginePayment>(
		db,
		`SELECT card.id AS cardAccountId, t.date, t.amount
		 FROM transactions t
		 JOIN accounts a ON a.id = t.account_id
		 JOIN transactions p ON p.id = t.transfer_id
		 JOIN accounts card ON card.id = p.account_id
		 WHERE a.on_budget = 1 AND a.type <> 'credit_card' AND card.type = 'credit_card'`
	);

	const assignments = all<EngineAssignment>(
		db,
		'SELECT category_id AS categoryId, month, assigned FROM budget_assignments'
	);

	return { categories, entries, payments, assignments };
}
