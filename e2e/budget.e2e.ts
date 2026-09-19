import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test('shows the month with Ready to Assign and the starter categories', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$0.00');
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
});

test('sends invalid months to the current one', async ({ page }) => {
	await onboard(page);
	const current = page.url();
	await page.goto('/budget/9999-01');
	await expect(page).toHaveURL(current);
});

test('assigns inline with arithmetic on desktop', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('250+50');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(page.getByTestId('rta-amount')).toHaveText('$700.00');
	await expect(groceries.getByTestId('available')).toHaveText('$300.00');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('assigns and moves money from the category sheet', async ({ page }) => {
		await onboard(page);
		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		const sheet = page.getByRole('dialog');
		await sheet.getByLabel('Assigned this month').fill('120+35');
		await sheet.getByRole('button', { name: 'Save' }).first().click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$155.00');

		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		await sheet.getByLabel('Other category').selectOption({ label: 'Everyday · Household' });
		await sheet.getByLabel('Amount to move').fill('55');
		await sheet.getByRole('button', { name: 'Move', exact: true }).click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
		await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$55.00');
	});
});
