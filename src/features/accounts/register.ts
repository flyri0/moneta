import type { Account } from '$db/repos/accounts';
import type { TransactionRow } from '$db/repos/transactions';

/** The payee the repos write for starting balances (stored in English, shown translated). */
export const STARTING_BALANCE_PAYEE = 'Starting Balance';

export function isStartingBalance(payeeName: string | null | undefined): boolean {
	if (!payeeName) return false;
	const lower = payeeName.trim().toLowerCase();
	return lower === 'starting balance' || lower === 'saldo inicial';
}

export type PayeeDisplay =
	| { kind: 'transfer'; direction: 'to' | 'from'; accountId: string; accountName: string }
	| { kind: 'starting-balance' }
	| { kind: 'payee'; name: string }
	| { kind: 'none' };

/** Transfers store no payee: they show as "Transfer to/from ‹account›", linking to the other leg. */
export function payeeDisplay(
	row: Pick<TransactionRow, 'amount' | 'payeeName' | 'transferAccountId' | 'transferAccountName'>
): PayeeDisplay {
	if (row.transferAccountId && row.transferAccountName)
		return {
			kind: 'transfer',
			direction: row.amount < 0 ? 'to' : 'from',
			accountId: row.transferAccountId,
			accountName: row.transferAccountName
		};
	if (isStartingBalance(row.payeeName)) return { kind: 'starting-balance' };
	return row.payeeName ? { kind: 'payee', name: row.payeeName } : { kind: 'none' };
}

export interface RegisterBalances {
	cleared: number;
	uncleared: number;
	total: number;
}

export function registerBalances(
	account: Pick<Account, 'balance' | 'clearedBalance'>
): RegisterBalances {
	return {
		cleared: account.clearedBalance,
		uncleared: account.balance - account.clearedBalance,
		total: account.balance
	};
}

/** How many rows the register loads at a time. */
export const PAGE_SIZE = 100;
