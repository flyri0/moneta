import { expect, test } from '@playwright/test';
import { onboard, chooseCombobox } from './helpers';

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

for (const form of ['transaction', 'schedule'] as const) {
	test(`overlapping submits create only one ${form}`, async ({ page }) => {
		await onboard(page);
		if (form === 'schedule') {
			await page.goto('/transactions/scheduled');
			await page.getByRole('button', { name: 'Add schedule' }).first().click();
		} else await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Amount', { exact: true }).fill('10');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
		await dialog.locator('form').evaluate((form) => {
			form.requestSubmit();
			form.requestSubmit();
		});
		await expect(dialog).toBeHidden();
		if (form === 'schedule') await expect(page.getByTestId('schedule-row')).toHaveCount(1);
		else {
			await page.goto('/transactions');
			await expect(page.getByTestId('register-row')).toHaveCount(2);
		}
	});
}
