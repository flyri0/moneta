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
