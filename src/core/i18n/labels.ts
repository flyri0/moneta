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
