import { describe, it, expect } from 'vitest';
import { m } from '$i18n/paraglide/messages';
import { defaultCategoryGroups, defaultIncomeCategories } from './defaults';
import {
	accountOptionLabel,
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

	it('formats account option labels with disambiguation when needed', () => {
		const checking = { id: 'c1', name: 'Checking', type: 'checking' as const };
		const savings = { id: 's1', name: 'Savings', type: 'savings' as const };
		const poupChecking = { id: 'p1', name: 'Poupança', type: 'checking' as const };
		const poupSavings = { id: 'p2', name: 'Poupança', type: 'savings' as const };
		const poupSavings2 = { id: 'p3', name: 'Poupança', type: 'savings' as const };

		// Unique names keep plain name
		expect(accountOptionLabel(checking, [checking, savings])).toBe('Checking');

		// Same name, different types include type label
		expect(accountOptionLabel(poupChecking, [poupChecking, poupSavings])).toBe(
			`Poupança (${accountTypeLabel('checking')})`
		);
		expect(accountOptionLabel(poupSavings, [poupChecking, poupSavings])).toBe(
			`Poupança (${accountTypeLabel('savings')})`
		);

		// Same name and same type include index
		expect(accountOptionLabel(poupSavings, [poupSavings, poupSavings2])).toBe(
			`Poupança (${accountTypeLabel('savings')} 1)`
		);
		expect(accountOptionLabel(poupSavings2, [poupSavings, poupSavings2])).toBe(
			`Poupança (${accountTypeLabel('savings')} 2)`
		);
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

describe('defaultIncomeCategories', () => {
	it('offers the starter income categories in each language', () => {
		expect(defaultIncomeCategories('en')).toEqual(['Salary', 'Other Income', 'Starting Balance']);
		expect(defaultIncomeCategories('pt-BR')).toEqual([
			'Salário',
			'Outras receitas',
			'Saldo inicial'
		]);
	});
});
