import type { Component } from 'svelte';
import { m } from '$i18n/paraglide/messages';
import AccountsCard from './AccountsCard.svelte';
import AgeOfMoneyCard from './AgeOfMoneyCard.svelte';
import CashFlowCard from './CashFlowCard.svelte';
import CategoryTrendsCard from './CategoryTrendsCard.svelte';
import NetWorthCard from './NetWorthCard.svelte';
import PayeesCard from './PayeesCard.svelte';
import SpendingCard from './SpendingCard.svelte';
import type { ReportId } from './layout';

/** Each report's name and its card on the overview. The full report is at `/reports/<id>`. */
export const REPORTS: Record<ReportId, { title: () => string; card: Component }> = {
	spending: { title: m.reports_spending, card: SpendingCard },
	'net-worth': { title: m.reports_net_worth, card: NetWorthCard },
	'cash-flow': { title: m.reports_cash_flow, card: CashFlowCard },
	payees: { title: m.reports_payees, card: PayeesCard },
	'category-trends': { title: m.reports_category_trends, card: CategoryTrendsCard },
	accounts: { title: m.reports_accounts, card: AccountsCard },
	'age-of-money': { title: m.reports_age_of_money, card: AgeOfMoneyCard }
};
