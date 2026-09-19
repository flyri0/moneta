import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

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
