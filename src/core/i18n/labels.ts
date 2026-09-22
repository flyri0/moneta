import type { AccountType } from '$db/repos/accounts';
import type { GroupNode } from '$db/repos/categories';
import { m } from '$i18n/paraglide/messages';

export function groupLabel(group: { name: string; system: GroupNode['system'] }): string {
	if (group.system === 'income') return m.group_income();
	return group.name;
}

export function categoryLabel(category: { name: string }): string {
	return category.name;
}

/** For transaction rows and split lines, which only carry the category's stored name. */
export function storedCategoryLabel(name: string): string {
	return name;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, () => string> = {
	checking: m.account_type_checking,
	savings: m.account_type_savings,
	cash: m.account_type_cash,
	credit_card: m.account_type_credit_card,
	investment: m.account_type_investment,
	loan: m.account_type_loan,
	other: m.account_type_other
};

export function accountTypeLabel(type: AccountType): string {
	return ACCOUNT_TYPE_LABELS[type]();
}

const ACCOUNT_TYPE_DESCRIPTIONS: Record<AccountType, () => string> = {
	checking: m.account_type_checking_desc,
	savings: m.account_type_savings_desc,
	cash: m.account_type_cash_desc,
	credit_card: m.account_type_credit_card_desc,
	investment: m.account_type_investment_desc,
	loan: m.account_type_loan_desc,
	other: m.account_type_other_desc
};

export function accountTypeDescription(type: AccountType): string {
	return ACCOUNT_TYPE_DESCRIPTIONS[type]();
}

/** Formats an account name for selection lists, disambiguating duplicates with type and index. */
export function accountOptionLabel(
	account: { id: string; name: string; type: AccountType },
	accounts: { id: string; name: string; type: AccountType }[]
): string {
	const sameName = accounts.filter(
		(a) => a.name.trim().toLowerCase() === account.name.trim().toLowerCase()
	);
	if (sameName.length <= 1) {
		return account.name;
	}
	const sameNameAndType = sameName.filter((a) => a.type === account.type);
	const typeName = accountTypeLabel(account.type);
	if (sameNameAndType.length <= 1) {
		return `${account.name} (${typeName})`;
	}
	const index = sameNameAndType.findIndex((a) => a.id === account.id);
	return `${account.name} (${typeName} ${index + 1})`;
}
