import { describe, it, expect } from 'vitest';
import { m } from '$i18n/paraglide/messages';
import { defaultCategoryGroups } from './defaults';
import {
	accountTypeDescription,
	accountTypeLabel,
	categoryLabel,
	groupLabel,
	storedCategoryLabel
} from './labels';

describe('labels', () => {
	it('translates system groups and leaves user names alone', () => {
		expect(groupLabel({ name: 'Income', system: 'income' })).toBe(m.group_income());
		expect(groupLabel({ name: 'Bills', system: null })).toBe('Bills');
		expect(categoryLabel({ name: 'Food' })).toBe('Food');
		expect(storedCategoryLabel('Food')).toBe('Food');
	});

	it('names account types', () => {
		expect(accountTypeLabel('credit_card')).toBe(m.account_type_credit_card());
		expect(accountTypeLabel('checking')).toBe(m.account_type_checking());
	});

	it('describes account types', () => {
		expect(accountTypeDescription('checking')).toBe(m.account_type_checking_desc());
		expect(accountTypeDescription('credit_card')).toBe(m.account_type_credit_card_desc());
	});
});

describe('defaultCategoryGroups', () => {
	it('offers the starter categories in each language', () => {
		const en = defaultCategoryGroups('en');
		const pt = defaultCategoryGroups('pt-BR');
		expect(en[1]).toEqual({
			name: 'Everyday',
			categories: ['Groceries', 'Transportation', 'Dining Out', 'Household']
		});
		expect(pt[1].name).toBe('Dia a dia');
		expect(pt.map((g) => g.categories.length)).toEqual(en.map((g) => g.categories.length));
	});
});
