import { m } from '$i18n/paraglide/messages';
import type { Locale } from '$i18n/paraglide/runtime';

/** The starter category groups offered during onboarding, in `locale` (default: the UI language). */
export function defaultCategoryGroups(locale?: Locale): { name: string; categories: string[] }[] {
	const o = locale ? { locale } : {};
	return [
		{
			name: m.default_group_bills({}, o),
			categories: [
				m.default_category_rent({}, o),
				m.default_category_utilities({}, o),
				m.default_category_phone_internet({}, o),
				m.default_category_insurance({}, o)
			]
		},
		{
			name: m.default_group_everyday({}, o),
			categories: [
				m.default_category_groceries({}, o),
				m.default_category_transport({}, o),
				m.default_category_dining_out({}, o),
				m.default_category_household({}, o)
			]
		},
		{
			name: m.default_group_goals({}, o),
			categories: [m.default_category_emergency_fund({}, o), m.default_category_vacation({}, o)]
		},
		{
			name: m.default_group_fun({}, o),
			categories: [m.default_category_entertainment({}, o), m.default_category_hobbies({}, o)]
		}
	];
}

/** The starter income categories offered during onboarding, in `locale` (default: the UI language). */
export function defaultIncomeCategories(locale?: Locale): string[] {
	const o = locale ? { locale } : {};
	return [
		m.default_category_salary({}, o),
		m.default_category_other_income({}, o),
		m.default_category_starting_balance({}, o)
	];
}
