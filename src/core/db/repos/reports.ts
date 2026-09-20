import { DomainError } from '$domain/errors';
import { isDate, isMonth, type Month } from '$domain/month';
import { netWorthSeries, type AccountMonthChange, type NetWorthPoint } from '$domain/net-worth';
import { all, type Db } from '../connection';

export interface SpendingRow {
	categoryId: string;
	name: string;
	groupName: string;
	amount: number; // net spending: outflows minus refunds, > 0
}

export interface SpendingQuery {
	from: string; // YYYY-MM-DD, inclusive
	to: string;
}

/**
 * Net spending per category over a date range, on-budget accounts only, largest first.
 * Income (Ready to Assign) is left out, and so are categories whose refunds outweigh spending.
 */
export function spendingByCategory(db: Db, query: SpendingQuery): SpendingRow[] {
	if (!isDate(query.from) || !isDate(query.to) || query.from > query.to)
		throw new DomainError('INVALID_INPUT', 'Invalid date range');
	return all<SpendingRow>(
		db,
		`SELECT c.id AS categoryId, c.name, g.name AS groupName, -SUM(e.amount) AS amount
		 FROM (
			SELECT t.category_id AS categoryId, t.amount
			FROM transactions t JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.is_split = 0 AND t.category_id IS NOT NULL
			  AND t.date BETWEEN :from AND :to
			UNION ALL
			SELECT s.category_id, s.amount
			FROM transaction_splits s
			JOIN transactions t ON t.id = s.transaction_id
			JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.date BETWEEN :from AND :to
		 ) e
		 JOIN categories c ON c.id = e.categoryId
		 JOIN category_groups g ON g.id = c.group_id
		 WHERE c.system IS NULL
		 GROUP BY c.id
		 HAVING SUM(e.amount) < 0
		 ORDER BY SUM(e.amount), c.name`,
		{ ':from': query.from, ':to': query.to }
	);
}

/** Month-end assets, debts and net worth across every account, through `through`. */
export function netWorth(db: Db, through: Month): NetWorthPoint[] {
	if (!isMonth(through)) throw new DomainError('INVALID_INPUT', `Invalid month ${through}`);
	const changes = all<AccountMonthChange>(
		db,
		`SELECT account_id AS accountId, substr(date, 1, 7) AS month, SUM(amount) AS amount
		 FROM transactions GROUP BY account_id, month`
	);
	return netWorthSeries(changes, through);
}
