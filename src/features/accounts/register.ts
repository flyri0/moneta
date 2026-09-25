import type { Account } from '$db/repos/accounts';
import type { UpcomingOccurrence } from '$db/repos/schedules';
import type { TransactionRow } from '$db/repos/transactions';
import { m } from '$i18n/paraglide/messages';

export type PayeeDisplay =
	| { kind: 'transfer'; direction: 'to' | 'from'; accountId: string; accountName: string }
	| { kind: 'starting-balance' }
	| { kind: 'payee'; name: string }
	| { kind: 'none' };

/**
 * Transfers store no payee: they show as "Transfer to/from ‹account›", linking to the other leg.
 * A starting balance without a payee shows as one.
 */
export function payeeDisplay(
	row: Pick<TransactionRow, 'amount' | 'payeeName' | 'transferAccountId' | 'transferAccountName'> &
		Partial<Pick<TransactionRow, 'isOpening'>>
): PayeeDisplay {
	if (row.transferAccountId && row.transferAccountName)
		return {
			kind: 'transfer',
			direction: row.amount < 0 ? 'to' : 'from',
			accountId: row.transferAccountId,
			accountName: row.transferAccountName
		};
	if (row.isOpening && !row.payeeName) return { kind: 'starting-balance' };
	return row.payeeName ? { kind: 'payee', name: row.payeeName } : { kind: 'none' };
}

/** A payee display as plain text, for rows that show it without a link. */
export function payeeText(display: PayeeDisplay): string {
	switch (display.kind) {
		case 'transfer':
			return display.direction === 'to'
				? m.register_transfer_to({ account: display.accountName })
				: m.register_transfer_from({ account: display.accountName });
		case 'starting-balance':
			return m.register_starting_balance();
		case 'payee':
			return display.name;
		case 'none':
			return m.register_no_payee();
	}
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

/** How many days ahead an account register forecasts its schedules. */
export const FORECAST_DAYS = 30;

/** The balance after each occurrence, in order, starting from `balance`. */
export function projectBalances(
	balance: number,
	occurrences: Pick<UpcomingOccurrence, 'amount'>[]
): number[] {
	let running = balance;
	return occurrences.map((o) => (running += o.amount));
}
