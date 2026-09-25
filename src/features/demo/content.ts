import { currencyDigits } from '$domain/money';
import { todayIso } from '$domain/month';
import { defaultCategoryGroups } from '$i18n/defaults';
import { suggestCurrency } from '$i18n/formats';
import { m } from '$i18n/paraglide/messages';
import { buildDemo, type DemoCategoryNames } from './dataset';
import type { DemoBudgetSeed } from './seed';

/** The browser's own number and date format, so the demo shows money the way the visitor reads it. */
export function demoLocale(browser?: string): string {
	try {
		return (browser && Intl.getCanonicalLocales(browser)[0]) || 'en-US';
	} catch {
		return 'en-US';
	}
}

/**
 * Everything a demo budget is made of, in the UI language: the meta and starter categories any
 * budget starts with, plus the accounts, a year of history and the assignments that fill it in.
 */
export function demoBudget(browser?: string, today: string = todayIso()): DemoBudgetSeed {
	const locale = demoLocale(browser);
	const currency = suggestCurrency(locale);
	const groups = defaultCategoryGroups();
	const [bills, everyday, goals, fun] = groups;
	// The income categories `initBudget` creates, named by the budget's locale.
	const pt = locale.startsWith('pt');
	const categories: DemoCategoryNames = {
		salary: pt ? 'Salário' : 'Salary',
		otherIncome: pt ? 'Outras receitas' : 'Other Income',
		rent: bills.categories[0],
		utilities: bills.categories[1],
		phone: bills.categories[2],
		insurance: bills.categories[3],
		groceries: everyday.categories[0],
		transport: everyday.categories[1],
		dining: everyday.categories[2],
		household: everyday.categories[3],
		emergencyFund: goals.categories[0],
		vacation: goals.categories[1],
		entertainment: fun.categories[0],
		hobbies: fun.categories[1]
	};
	return {
		init: { name: m.demo_budget_name(), currency, locale, groups },
		seed: buildDemo({
			today,
			scale: 10 ** currencyDigits(currency),
			accounts: {
				checking: m.demo_account_checking(),
				savings: m.demo_account_savings(),
				card: m.demo_account_card()
			},
			payees: {
				salary: m.demo_payee_salary(),
				newEmployer: m.demo_payee_new_employer(),
				freelance: m.demo_payee_freelance(),
				benefits: m.demo_payee_benefits(),
				landlord: m.demo_payee_landlord(),
				utility: m.demo_payee_utility(),
				telecom: m.demo_payee_telecom(),
				insurance: m.demo_payee_insurance(),
				grocery: m.demo_payee_grocery(),
				transport: m.demo_payee_transport(),
				coffee: m.demo_payee_coffee(),
				restaurant: m.demo_payee_restaurant(),
				household: m.demo_payee_household(),
				streaming: m.demo_payee_streaming(),
				hobby: m.demo_payee_hobby(),
				mechanic: m.demo_payee_mechanic(),
				airline: m.demo_payee_airline(),
				hotel: m.demo_payee_hotel(),
				pharmacy: m.demo_payee_pharmacy(),
				clinic: m.demo_payee_clinic()
			},
			categories
		})
	};
}
