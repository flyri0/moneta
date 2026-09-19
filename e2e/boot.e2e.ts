import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('a second tab waits until it takes over', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);

	const second = await context.newPage();
	await second.goto('/');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await second.getByRole('button', { name: 'Use Moneta here' }).click();
	await expect(second.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(first.getByText('Moneta is open in another tab')).toBeVisible();
});
