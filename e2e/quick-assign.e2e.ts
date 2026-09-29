import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('quick assign shows what each option would assign before applying it', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Quick assign' }).click();
	await expect(sheet.getByText("No option would change what's assigned.")).toBeVisible();
	await sheet.getByRole('button', { name: 'Back' }).click();

	await sheet.getByLabel('Assigned this month').fill('100');
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();

	await groceries.getByRole('button', { name: 'Groceries' }).click();
	await sheet.getByRole('button', { name: 'Quick assign' }).click();
	await expect(sheet.getByRole('heading', { name: 'Quick assign' })).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Same as last month $0.00' })).toBeVisible();
	// Nothing is overspent: covering it would change nothing.
	await expect(sheet.getByRole('button', { name: /Cover overspending/ })).toBeHidden();

	await sheet.getByRole('button', { name: 'Clear $0.00' }).click();
	await expect(sheet).toBeHidden();
	await expect(groceries.getByTestId('available')).toHaveText('$0.00');
	await expect(page.getByText('Quick assign: Clear.')).toBeVisible();
});
