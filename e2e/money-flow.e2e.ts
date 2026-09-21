import { expect, test, type Page } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard } from './helpers';

async function addTransaction(
	page: Page,
	t: { account: string; payee: string; amount: string; category?: string; inflow?: boolean }
) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Account', t.account, t.account);
	await chooseCombobox(dialog, 'Payee', t.payee, t.payee);
	if (t.inflow) await dialog.getByRole('button', { name: 'Inflow' }).click();
	await dialog.getByLabel('Amount', { exact: true }).fill(t.amount);
	if (t.category) await chooseCombobox(dialog, 'Category', t.category, t.category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('income, assigning, spending, a card purchase and a card payment add up', async ({ page }) => {
	await onboard(page);

	await addTransaction(page, {
		account: 'Checking',
		payee: 'Employer',
		amount: '500',
		category: 'Ready to Assign',
		inflow: true
	});
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,500.00');

	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('300');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,200.00');

	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Credit card' }).click();
	await dialog.getByLabel('Account name').fill('Visa');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('link', { name: 'Budget' }).first().click();

	await addTransaction(page, {
		account: 'Checking',
		payee: 'Market',
		amount: '50',
		category: 'Groceries'
	});
	await expect(groceries.getByTestId('available')).toHaveText('$250.00');

	await addTransaction(page, {
		account: 'Visa',
		payee: 'Shop',
		amount: '100',
		category: 'Groceries'
	});
	await expect(groceries.getByTestId('available')).toHaveText('$150.00');
	await expect(categoryRow(page, 'Visa').getByTestId('available')).toHaveText('$100.00');

	await addTransaction(page, { account: 'Checking', payee: 'Transfer: Visa', amount: '100' });
	await expect(categoryRow(page, 'Visa').getByTestId('available')).toHaveText('$0.00');
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,200.00');

	const accounts = page.getByTestId('account-row');
	await expect(accounts.filter({ hasText: 'Checking' }).getByTestId('account-balance')).toHaveText(
		'$1,350.00'
	);
	await expect(accounts.filter({ hasText: 'Visa' }).getByTestId('account-balance')).toHaveText(
		'$0.00'
	);
});

test('records a split and shows it in the register', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
	await expect(page.getByTestId('register-row')).toHaveCount(1);

	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Big Store', 'Big Store');
	await dialog.getByLabel('Amount', { exact: true }).fill('80');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByRole('button', { name: 'Split' }).click();
	await dialog.getByLabel('Amount for line 1').fill('50');
	await expect(dialog.getByTestId('split-remaining')).toHaveText('Remaining: $30.00');
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
	await chooseCombobox(dialog, 'Category for line 2', 'Household', 'Household');
	await dialog.getByLabel('Amount for line 2').fill('30');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const row = page.getByTestId('register-row').filter({ hasText: 'Big Store' });
	await expect(row.getByTestId('register-amount')).toHaveText('-$80.00');
	await row.getByRole('button', { name: 'Split (2)' }).click();
	await expect(row.getByText('Household')).toBeVisible();
	await expect(page.getByTestId('register-balance')).toHaveText('$920.00');
});
