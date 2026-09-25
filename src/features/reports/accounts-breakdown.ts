import type { AccountBalancesPoint } from '$domain/net-worth';
import type { Account, AccountType } from '$db/repos/accounts';

/** An open account's share of the assets or of the debts. Debts are positive amounts owed. */
export interface AccountSlice {
	id: string;
	name: string;
	type: AccountType;
	amount: number;
}

/** Open accounts split into what is owned and what is owed, largest first. */
export function accountBreakdown(accounts: Account[]): {
	assets: AccountSlice[];
	debts: AccountSlice[];
	totalAssets: number;
	totalDebts: number;
} {
	const open = accounts.filter((a) => !a.closed && a.balance !== 0);
	const slice = (a: Account, amount: number) => ({ id: a.id, name: a.name, type: a.type, amount });
	const assets = open
		.filter((a) => a.balance > 0)
		.map((a) => slice(a, a.balance))
		.sort((a, b) => b.amount - a.amount);
	const debts = open
		.filter((a) => a.balance < 0)
		.map((a) => slice(a, -a.balance))
		.sort((a, b) => b.amount - a.amount);
	return {
		assets,
		debts,
		totalAssets: assets.reduce((sum, a) => sum + a.amount, 0),
		totalDebts: debts.reduce((sum, a) => sum + a.amount, 0)
	};
}

/**
 * How much of a debt is paid off: the most it owed at a month end in `series`, what it owes at
 * the last one, and the share paid since the peak. Null when the account never owed anything.
 */
export function debtProgress(
	series: AccountBalancesPoint[],
	accountId: string
): { peak: number; current: number; paid: number } | null {
	const owed = series.map((p) => -(p.balances[accountId] ?? 0));
	const peak = Math.max(0, ...owed);
	if (peak === 0) return null;
	const current = Math.max(0, owed.at(-1) ?? 0);
	return { peak, current, paid: (peak - current) / peak };
}
