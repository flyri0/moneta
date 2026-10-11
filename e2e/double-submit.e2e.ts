import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('a double click on Add account creates one account', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByLabel('Account name').fill('Rainy day');
	await dialog.getByLabel('Current balance').fill('250');
	await dialog.getByRole('button', { name: 'Add account' }).dblclick();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('main').getByText('Rainy day', { exact: true })).toHaveCount(1);
});

test('a double click on Add group creates one group', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Add group' }).first().click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Group name').fill('Pets');
	await dialog.getByRole('button', { name: 'Add' }).dblclick();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('main').getByText('Pets', { exact: true })).toHaveCount(1);
});
