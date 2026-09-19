import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('navigates between screens and switches the language', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await page.getByLabel('Language').selectOption('pt-BR');
	await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
	await page.getByRole('link', { name: 'Orçamento' }).first().click();
	await expect(page.getByText('Pronto para atribuir').first()).toBeVisible();
});

test('adds, closes and protects accounts', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Account name').fill('Old savings');
	await dialog.getByLabel('Type').selectOption('savings');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	const main = page.getByRole('main');
	await main.getByRole('button', { name: 'Settings for Old savings' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog).toBeHidden();
	await expect(main.getByRole('region', { name: 'Closed' })).toContainText('Old savings');

	await main.getByRole('button', { name: 'Settings for Checking' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog.getByRole('alert')).toHaveText(
		'Only accounts with a zero balance can be closed.'
	);
});
