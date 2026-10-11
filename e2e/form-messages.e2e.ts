import { expect, test } from '@playwright/test';
import { chooseSelect, onboard, openSettings } from './helpers';

test('an empty account name is reported in the form, not by the browser', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog.getByTestId('form-message')).toHaveText('Enter a name.');
	expect(
		await dialog.getByLabel('Account name').evaluate((el: HTMLInputElement) => el.validity.valid)
	).toBe(true);
});

test('an empty transaction amount is reported in the app language', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await chooseSelect(page, 'Language', 'Português (Brasil)');
	await page.getByRole('button', { name: 'Transação', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Salvar' }).click();
	await expect(dialog.getByTestId('form-message')).toContainText('Informe um valor válido');
});

test('a form error goes away once the field is edited, and comes back on the next try', async ({
	page
}) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	const amount = dialog.getByLabel('Amount', { exact: true });
	await amount.fill('abc');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByTestId('form-message')).toBeVisible();
	await amount.fill('12');
	await expect(dialog.getByTestId('form-message')).toBeHidden();
	await amount.fill('abc');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByTestId('form-message')).toBeVisible();
});
