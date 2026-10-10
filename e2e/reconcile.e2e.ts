import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, onboard, pickDate } from './helpers';

async function openChecking(page: Page) {
	await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
}

test('reconciles a matching balance and locks the cleared transactions', async ({ page }) => {
	await onboard(page);
	await openChecking(page);

	await page.getByRole('button', { name: 'Reconcile' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByTestId('reconcile-cleared')).toHaveText('$1,000.00');
	await dialog.getByRole('button', { name: 'Yes, reconcile' }).click();
	await expect(dialog).toBeHidden();

	const row = page.getByTestId('register-row');
	await expect(row.getByTestId('register-reconciled')).toBeVisible();
	await expect(row.getByRole('button', { name: 'Cleared' })).toHaveCount(0);
	await expect(page.getByTestId('register-reconciled-on')).toContainText('Reconciled on');

	// Editing still works, with a warning, and the transaction stays cleared.
	await row.getByRole('button', { name: 'Starting balance' }).click();
	const edit = page.getByRole('dialog');
	await expect(edit.getByTestId('transaction-overview')).toContainText('Reconciled');
	await edit.getByRole('button', { name: 'Edit transaction' }).click();
	await expect(edit.getByTestId('reconciled-notice')).toBeVisible();
	await expect(edit.getByLabel('Cleared')).toBeDisabled();
});

test('enters the difference as an adjustment', async ({ page }) => {
	await onboard(page);
	await openChecking(page);

	await page.getByRole('button', { name: 'Reconcile' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'No' }).click();
	await dialog.getByLabel('Balance at the bank').fill('990');
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog.getByTestId('reconcile-difference')).toHaveText('-$10.00');
	const adjust = dialog.getByRole('button', { name: 'Add adjustment and reconcile' });
	await expect(adjust).toBeDisabled();
	await chooseCombobox(dialog, 'Category for the adjustment', 'Groceries', 'Groceries');
	await adjust.click();
	await expect(dialog).toBeHidden();

	await expect(page.getByTestId('register-balance')).toHaveText('$990.00');
	const rows = page.getByTestId('register-row');
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText('Reconciliation adjustment');
	await expect(page.getByTestId('register-reconciled')).toHaveCount(2);
});

test('checks the bank balance against what was cleared through the chosen date', async ({
	page
}) => {
	await onboard(page);
	await openChecking(page);

	await page.getByRole('button', { name: 'Reconcile' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'No' }).click();
	// Two days ago the account was still empty: the bank's $0 matches, with no difference to enter.
	const d = new Date();
	d.setDate(d.getDate() - 2);
	const date = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
		.map((n) => String(n).padStart(2, '0'))
		.join('-');
	await pickDate(dialog, 'Balance date', date);
	await expect(dialog.getByText(/Your cleared balance is/)).toContainText('$0.00');
	await dialog.getByLabel('Balance at the bank').fill('0');
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('register-reconciled-on')).toContainText('Reconciled on');
});
