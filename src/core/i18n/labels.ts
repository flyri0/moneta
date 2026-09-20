import type { AccountType } from '$db/repos/accounts';
import type { CategoryNode, GroupNode } from '$db/repos/categories';
import { m } from '$i18n/paraglide/messages';

/** The repos store system names in English; these show them in the UI language. */
const STORED_READY_TO_ASSIGN = 'Ready to Assign';

export function groupLabel(group: { name: string; system: GroupNode['system'] }): string {
	if (group.system === 'income') return m.group_income();
	if (group.system === 'credit_card_payments') return m.group_cc_payments();
	return group.name;
}

export function categoryLabel(category: { name: string; system: CategoryNode['system'] }): string {
	return category.system === 'ready_to_assign' ? m.ready_to_assign() : category.name;
}

/** For transaction rows and split lines, which only carry the category's stored name. */
export function storedCategoryLabel(name: string): string {
	return name === STORED_READY_TO_ASSIGN ? m.ready_to_assign() : name;
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
