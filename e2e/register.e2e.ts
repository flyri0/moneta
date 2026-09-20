import { expect, test } from '@playwright/test';
import { chooseCombobox, onboard } from './helpers';

test('shows the register with balances, cleared toggles and search', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');

	const row = page.getByTestId('register-row');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('Starting balance');
	await expect(row.getByTestId('register-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('register-balance')).toHaveText('$1,000.00');

	await row.getByRole('button', { name: 'Cleared' }).click();
	await expect(row.getByRole('button', { name: 'Cleared' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('No transactions.')).toBeVisible();
	await page.getByRole('searchbox').fill('');
	await expect(row).toHaveCount(1);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('shows category, memo and the split toggle on the register row', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).click();
		await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();

		await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Payee').fill('Market');
		await dialog.getByLabel('Amount', { exact: true }).fill('40');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
		await dialog.getByLabel('Memo').fill('Weekly run');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		const row = page.getByTestId('register-row').filter({ hasText: 'Market' });
		await expect(row).toContainText('Groceries');
		await expect(row).toContainText('Weekly run');

		await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		await dialog.getByLabel('Payee').fill('Big Store');
		await dialog.getByLabel('Amount', { exact: true }).fill('80');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
		await dialog.getByRole('button', { name: 'Split' }).click();
		await dialog.getByLabel('Amount for line 1').fill('50');
		await chooseCombobox(dialog, 'Category for line 2', 'Household', 'Household');
		await dialog.getByLabel('Amount for line 2').fill('30');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		const splitRow = page.getByTestId('register-row').filter({ hasText: 'Big Store' });
		await splitRow.getByRole('button', { name: 'Split (2)' }).click();
		await expect(splitRow.getByText('Household')).toBeVisible();
	});
});
