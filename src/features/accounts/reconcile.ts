import type { AccountType } from '$db/repos/accounts';
import { isDebtType } from './account-form';

/** How a balance reads to the user: an amount owed, positive, for credit cards and loans. */
export function shownBalance(type: AccountType, balance: number): number {
	return isDebtType(type) && balance !== 0 ? -balance : balance;
}

/** The signed balance behind what the user typed (an amount owed for debt accounts). */
export function typedBalance(type: AccountType, typed: number): number {
	return shownBalance(type, typed);
}

export type ReconcileCheck =
	| { kind: 'invalid' }
	| { kind: 'match'; balance: number }
	| { kind: 'difference'; balance: number; difference: number };

/**
 * Compares the balance the user typed (`null` when it doesn't parse) with the cleared balance.
 * `difference` is what an adjustment would add to the account.
 */
export function checkBalance(
	type: AccountType,
	typed: number | null,
	cleared: number
): ReconcileCheck {
	if (typed === null) return { kind: 'invalid' };
	const balance = typedBalance(type, typed);
	const difference = balance - cleared;
	return difference === 0
		? { kind: 'match', balance }
		: { kind: 'difference', balance, difference };
}
