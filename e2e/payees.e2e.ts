import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, onboard } from './helpers';

async function addTransaction(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', payee, payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await chooseCombobox(dialog, 'Category', category, category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('renames, merges, sets defaults for and removes payees', async ({ page }) => {
	await onboard(page);
	await addTransaction(page, 'Amzn', '10', 'Groceries');
	await addTransaction(page, 'Amazon', '20', 'Dining Out');
	await addTransaction(page, 'Typo shop', '5', 'Groceries');

	// Moving the last transaction to another payee leaves "Typo shop" unused.
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await page.getByTestId('register-row').getByRole('button', { name: 'Typo shop' }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Amazon', 'Amazon');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await sidebar.getByRole('link', { name: 'Payees' }).click();
	await expect(page.getByRole('heading', { name: 'Payees' })).toBeVisible();
	const rows = page.getByTestId('payee-row');
	await expect(rows).toHaveCount(4);
	await expect(rows.filter({ hasText: 'Amazon' })).toContainText('2 transactions');
	await expect(rows.filter({ hasText: 'Amzn' })).toContainText('1 transaction');
	await expect(rows.filter({ hasText: 'Starting balance' })).toContainText('Built-in');
	await expect(rows.filter({ hasText: 'Typo shop' })).toContainText('Unused');

	// Renaming renames every past transaction.
	await rows.filter({ hasText: 'Amazon' }).click();
	await dialog.getByLabel('Payee name').fill('Amazon Store');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
	await expect(rows.filter({ hasText: 'Amazon Store' })).toBeVisible();

	// Renaming to a name that exists offers a merge.
	await rows.filter({ hasText: 'Amzn' }).click();
	await dialog.getByLabel('Payee name').fill('amazon store');
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Merge into Amazon Store' }).click();
	await expect(dialog).toBeHidden();
	await expect(rows.filter({ hasText: 'Amzn' })).toHaveCount(0);
	await expect(rows.filter({ hasText: 'Amazon Store' })).toContainText('3 transactions');

	// The default category wins over the last one used (Groceries).
	await rows.filter({ hasText: 'Amazon Store' }).click();
	await chooseCombobox(dialog, 'Default category', 'Dining Out', 'Dining');
	await expect(rows.filter({ hasText: 'Amazon Store' })).toContainText('Default: Dining Out');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await chooseCombobox(dialog, 'Payee', 'Amazon Store', 'Amazon Store');
	await expect(dialog.getByLabel('Category', { exact: true })).toContainText('Dining Out');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await expect(
		page.getByTestId('register-row').getByRole('button', { name: 'Amazon Store' })
	).toHaveCount(3);

	// Unused payees go in one step.
	await sidebar.getByRole('link', { name: 'Payees' }).click();
	await page.getByRole('button', { name: 'Remove unused (1)' }).click();
	await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(rows.filter({ hasText: 'Typo shop' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Remove unused/ })).toBeHidden();

	await page.getByRole('searchbox').fill('store');
	await expect(rows).toHaveCount(1);
	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('No payees match “nothing like this”.')).toBeVisible();
});
