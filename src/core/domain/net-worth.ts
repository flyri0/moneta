import { compareMonths, monthRange, type Month } from './month';

/** The sum of an account's transactions dated in one month. */
export interface AccountMonthChange {
	accountId: string;
	month: Month;
	amount: number;
}

export interface NetWorthPoint {
	month: Month;
	assets: number; // Σ positive account balances at the end of the month
	debts: number; // Σ negative account balances (≤ 0)
	netWorth: number;
}

/** Every account's balance at the end of one month, keyed by account id. */
export interface AccountBalancesPoint {
	month: Month;
	balances: Record<string, number>;
}

/**
 * Month-end balances per account from the first month with data through `through` (or the last
 * month with data, if later). An account appears from its first transaction on.
 */
export function accountBalanceSeries(
	changes: AccountMonthChange[],
	through: Month
): AccountBalancesPoint[] {
	if (changes.length === 0) return [];
	const months = changes.map((c) => c.month).sort(compareMonths);
	const last =
		compareMonths(months[months.length - 1], through) > 0 ? months[months.length - 1] : through;
	const balances: Record<string, number> = {};
	return monthRange(months[0], last).map((month) => {
		for (const c of changes)
			if (c.month === month) balances[c.accountId] = (balances[c.accountId] ?? 0) + c.amount;
		return { month, balances: { ...balances } };
	});
}

/**
 * Month-end totals from the first month with data through `through` (or the last month with
 * data, if later). Each account counts as an asset or a debt by the sign of its balance.
 */
export function netWorthSeries(changes: AccountMonthChange[], through: Month): NetWorthPoint[] {
	return accountBalanceSeries(changes, through).map(({ month, balances }) => {
		let assets = 0;
		let debts = 0;
		for (const balance of Object.values(balances)) {
			if (balance > 0) assets += balance;
			else debts += balance;
		}
		return { month, assets, debts, netWorth: assets + debts };
	});
}
