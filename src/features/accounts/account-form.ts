import type { Account, AccountType } from '$db/repos/accounts';

export const ACCOUNT_TYPES: readonly AccountType[] = [
	'checking',
	'savings',
	'cash',
	'credit_card',
	'investment',
	'loan',
	'other'
];

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

export function accountCategory(type: AccountType): AccountCategoryKey {
	return type === 'investment' || type === 'loan' || type === 'other' ? 'tracking' : 'budget';
}

/**
 * Loans and investments default to off-budget: their balances aren't spendable cash, and an
 * on-budget starting balance would count as Ready to Assign income.
 */
export function defaultOnBudget(type: AccountType): boolean {
	return type !== 'investment' && type !== 'loan';
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
