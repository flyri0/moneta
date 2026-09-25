import { ageOfMoneySeries, type AgeOfMoneyPoint, type CashFlowEntry } from '$domain/age-of-money';
import { DomainError } from '$domain/errors';
import { isDate, isMonth, type Month } from '$domain/month';
import {
	accountBalanceSeries,
	netWorthSeries,
	type AccountBalancesPoint,
	type AccountMonthChange,
	type NetWorthPoint
} from '$domain/net-worth';
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
 * Income is left out, and so are categories whose refunds outweigh spending.
 */
export function spendingByCategory(db: Db, query: SpendingQuery): SpendingRow[] {
	checkRange(query);
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
		 WHERE g.system IS NULL
		 GROUP BY c.id
		 HAVING SUM(e.amount) < 0
		 ORDER BY SUM(e.amount), c.name`,
		{ ':from': query.from, ':to': query.to }
	);
}

export interface CashFlowRow {
	month: Month;
	income: number; // net inflow into the income categories
	spending: number; // net spending: outflows minus refunds
}

/**
 * Income against spending per month over a date range, on-budget accounts only, oldest first.
 * Only months with activity are returned. Starting balances land in the income category but
 * are money the user already had, so they are left out.
 */
export function cashFlow(db: Db, query: SpendingQuery): CashFlowRow[] {
	checkRange(query);
	return all<CashFlowRow>(
		db,
		`SELECT e.month,
			COALESCE(SUM(CASE WHEN g.system = 'income' THEN e.amount END), 0) AS income,
			-COALESCE(SUM(CASE WHEN g.system IS NULL THEN e.amount END), 0) AS spending
		 FROM (
			SELECT substr(t.date, 1, 7) AS month, t.category_id AS categoryId, t.amount,
				t.is_opening AS opening
			FROM transactions t JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.is_split = 0 AND t.category_id IS NOT NULL
			  AND t.date BETWEEN :from AND :to
			UNION ALL
			SELECT substr(t.date, 1, 7), s.category_id, s.amount, t.is_opening
			FROM transaction_splits s
			JOIN transactions t ON t.id = s.transaction_id
			JOIN accounts a ON a.id = t.account_id
			WHERE a.on_budget = 1 AND t.date BETWEEN :from AND :to
		 ) e
		 JOIN categories c ON c.id = e.categoryId
		 JOIN category_groups g ON g.id = c.group_id
		 WHERE NOT e.opening
		 GROUP BY e.month
		 ORDER BY e.month`,
		{ ':from': query.from, ':to': query.to }
	);
}

function checkRange(query: SpendingQuery): void {
	if (!isDate(query.from) || !isDate(query.to) || query.from > query.to)
		throw new DomainError('INVALID_INPUT', 'Invalid date range');
}

/**
 * Every categorized amount on an on-budget account in `:from`..`:to`: whole transactions and
 * split lines, with the month, the transaction's payee and whether it is a starting balance.
 */
const CATEGORIZED_SQL = `
	SELECT substr(t.date, 1, 7) AS month, t.category_id AS categoryId, t.amount, t.payee_id,
		t.transfer_id, t.is_opening AS opening
	FROM transactions t JOIN accounts a ON a.id = t.account_id
	WHERE a.on_budget = 1 AND t.is_split = 0 AND t.category_id IS NOT NULL
	  AND t.date BETWEEN :from AND :to
	UNION ALL
	SELECT substr(t.date, 1, 7), s.category_id, s.amount, t.payee_id, t.transfer_id, t.is_opening
	FROM transaction_splits s
	JOIN transactions t ON t.id = s.transaction_id
	JOIN accounts a ON a.id = t.account_id
	WHERE a.on_budget = 1 AND t.date BETWEEN :from AND :to`;

export interface CategoryMonthRow {
	month: Month;
	categoryId: string;
	name: string;
	groupId: string;
	groupName: string;
	income: boolean; // in the Income group
	amount: number; // signed: inflows positive, spending negative
}

/**
 * The net amount per category and month over a date range, on-budget accounts only, in budget
 * order, then oldest month first. Starting balances are left out, as in `cashFlow`, and so are
 * categories that netted to zero.
 */
export function categoryMonths(db: Db, query: SpendingQuery): CategoryMonthRow[] {
	checkRange(query);
	return all<Omit<CategoryMonthRow, 'income'> & { income: number }>(
		db,
		`SELECT e.month, c.id AS categoryId, c.name, g.id AS groupId, g.name AS groupName,
			g.system IS 'income' AS income, SUM(e.amount) AS amount
		 FROM (${CATEGORIZED_SQL}) e
		 JOIN categories c ON c.id = e.categoryId
		 JOIN category_groups g ON g.id = c.group_id
		 WHERE NOT e.opening
		 GROUP BY e.month, c.id
		 HAVING SUM(e.amount) <> 0
		 ORDER BY g.sort_order, g.name, c.sort_order, c.name, e.month`,
		{ ':from': query.from, ':to': query.to }
	).map((r) => ({ ...r, income: r.income === 1 }));
}

export interface PayeeSpendingRow {
	payeeId: string | null; // null: transactions without a payee
	name: string | null;
	amount: number; // net spending: outflows minus refunds, > 0
}

/**
 * Net spending per payee over a date range, on-budget accounts only, largest first. Income and
 * transfers are left out (a transfer has an account, not a payee), and so are payees whose refunds
 * outweigh spending. Split lines count toward the transaction's payee.
 */
export function spendingByPayee(db: Db, query: SpendingQuery): PayeeSpendingRow[] {
	checkRange(query);
	return all<PayeeSpendingRow>(
		db,
		`SELECT p.id AS payeeId, p.name, -SUM(e.amount) AS amount
		 FROM (${CATEGORIZED_SQL}) e
		 JOIN categories c ON c.id = e.categoryId
		 JOIN category_groups g ON g.id = c.group_id
		 LEFT JOIN payees p ON p.id = e.payee_id
		 WHERE g.system IS NULL AND e.transfer_id IS NULL
		 GROUP BY p.id
		 HAVING SUM(e.amount) < 0
		 ORDER BY SUM(e.amount), p.name IS NULL, p.name`,
		{ ':from': query.from, ':to': query.to }
	);
}

function accountMonthChanges(db: Db): AccountMonthChange[] {
	return all<AccountMonthChange>(
		db,
		`SELECT account_id AS accountId, substr(date, 1, 7) AS month, SUM(amount) AS amount
		 FROM transactions GROUP BY account_id, month`
	);
}

/** Month-end assets, debts and net worth across every account, through `through`. */
export function netWorth(db: Db, through: Month): NetWorthPoint[] {
	if (!isMonth(through)) throw new DomainError('INVALID_INPUT', `Invalid month ${through}`);
	return netWorthSeries(accountMonthChanges(db), through);
}

/** Each account's month-end balance, through `through`. */
export function accountBalances(db: Db, through: Month): AccountBalancesPoint[] {
	if (!isMonth(through)) throw new DomainError('INVALID_INPUT', `Invalid month ${through}`);
	return accountBalanceSeries(accountMonthChanges(db), through);
}

/**
 * The money moving in and out of the cash accounts (on-budget, not credit cards) through `today`,
 * which is what Age of Money follows. Moves between two cash accounts cancel out and are left out.
 * Card purchases are too: as in YNAB, card spending counts when the card is paid.
 */
export function ageOfMoneyFlows(db: Db, today: string): CashFlowEntry[] {
	if (!isDate(today)) throw new DomainError('INVALID_INPUT', `Invalid date ${today}`);
	return all<Omit<CashFlowEntry, 'opening'> & { opening: number }>(
		db,
		`SELECT t.date, t.id, t.amount,
			t.is_opening AS opening
		 FROM transactions t
		 JOIN accounts a ON a.id = t.account_id
		 LEFT JOIN transactions o ON o.id = t.transfer_id
		 LEFT JOIN accounts oa ON oa.id = o.account_id
		 WHERE a.on_budget = 1 AND a.type <> 'credit_card' AND t.amount <> 0 AND t.date <= :today
		   AND NOT COALESCE(oa.on_budget = 1 AND oa.type <> 'credit_card', 0)`,
		{ ':today': today }
	).map((r) => ({ ...r, opening: r.opening === 1 }));
}

/** Age of Money at the end of each month through `today` (YYYY-MM-DD). */
export function ageOfMoney(db: Db, today: string): AgeOfMoneyPoint[] {
	return ageOfMoneySeries(ageOfMoneyFlows(db, today), today);
}
