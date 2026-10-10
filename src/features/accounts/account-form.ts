import type { Account, AccountType } from '$db/repos/accounts';
import type { BillingDays } from '$domain/card-bill';

export type AccountCategoryKey = 'budget' | 'tracking';

export interface AccountTypeCategory {
	key: AccountCategoryKey;
	types: readonly AccountType[];
}

export const ACCOUNT_CATEGORIES: readonly AccountTypeCategory[] = [
	{
		key: 'budget',
		types: ['checking', 'savings', 'cash', 'credit_card']
	},
	{
		key: 'tracking',
		types: ['investment', 'loan', 'other']
	}
];

/**
 * Loans, investments and other accounts default to off-budget, as the type picker groups them
 * (`ACCOUNT_CATEGORIES`): their balances aren't spendable cash, and an on-budget starting balance
 * would count as Ready to Assign income.
 */
export function defaultOnBudget(type: AccountType): boolean {
	return type !== 'investment' && type !== 'loan' && type !== 'other';
}

/** Credit cards are always on-budget. */
export function onBudgetLocked(type: AccountType): boolean {
	return type === 'credit_card';
}

/** Debt accounts ask for the amount owed rather than a balance. */
export function isDebtType(type: AccountType): boolean {
	return type === 'credit_card' || type === 'loan';
}

/** Turns what the user typed into a signed balance: an amount owed becomes negative. */
export function signedStartingBalance(type: AccountType, typed: number): number {
	return isDebtType(type) && typed !== 0 ? -typed : typed;
}

function parseDay(text: string): number | null {
	const trimmed = text.trim();
	if (!/^\d{1,2}$/.test(trimmed)) return null;
	const day = Number(trimmed);
	return day >= 1 && day <= 31 ? day : null;
}

/**
 * A card's closing and due days, as typed: null when both are blank, 'invalid' when only one is
 * given or either isn't a day from 1 to 31.
 */
export function parseBillingDays(closing: string, due: string): BillingDays | null | 'invalid' {
	if (closing.trim() === '' && due.trim() === '') return null;
	const closingDay = parseDay(closing);
	const dueDay = parseDay(due);
	return closingDay === null || dueDay === null ? 'invalid' : { closingDay, dueDay };
}

export type AccountSectionKey = 'onBudget' | 'offBudget' | 'closed';

export interface AccountSection {
	key: AccountSectionKey;
	accounts: Account[];
	total: number;
}

/** Groups accounts the way the sidebar and the accounts page list them. Empty sections are left out. */
export function accountSections(accounts: Account[]): AccountSection[] {
	const sections: AccountSection[] = [
		{ key: 'onBudget', accounts: accounts.filter((a) => !a.closed && a.onBudget), total: 0 },
		{ key: 'offBudget', accounts: accounts.filter((a) => !a.closed && !a.onBudget), total: 0 },
		{ key: 'closed', accounts: accounts.filter((a) => a.closed), total: 0 }
	];
	for (const s of sections) s.total = s.accounts.reduce((sum, a) => sum + a.balance, 0);
	return sections.filter((s) => s.accounts.length > 0);
}
