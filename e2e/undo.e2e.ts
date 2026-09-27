import { expect, test } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard, spend } from './helpers';

test('brings back a deleted transaction', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '40', 'Groceries');
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('-$40.00');

	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	const rows = page.getByTestId('register-row');
	await expect(rows).toHaveCount(2);
	await rows.filter({ hasText: 'Market' }).getByRole('button', { name: 'Market' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toContainText('You can undo it right after.');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toBeHidden();
	await expect(rows).toHaveCount(1);

	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Transaction deleted.');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(toast).toContainText('Undone.');
	await expect(rows).toHaveCount(2);
	await expect(rows.filter({ hasText: 'Market' })).toContainText('-$40.00');
});

test('takes back moved money', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Assigned this month').fill('100');
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();

	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	await sheet.getByRole('button', { name: 'Move money' }).click();
	await chooseCombobox(sheet, 'Other category', 'Everyday · Household', 'Household');
	await sheet.getByLabel('Amount to move').fill('30');
	await sheet.getByRole('button', { name: 'Move', exact: true }).click();
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$30.00');

	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Moved $30.00 from Groceries to Household.');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$0.00');
});
