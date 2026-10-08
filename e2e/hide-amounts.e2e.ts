import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('the eye hides amounts on every screen and remembers it', async ({ page }) => {
	await onboard(page);
	const rta = page.getByTestId('rta-amount');
	const eye = page.getByTestId('page-header').getByRole('button', { name: 'Hide amounts' });

	await eye.click();
	await expect(rta).toHaveText('••••');

	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
	await expect(page.getByText('$1,000.00')).toHaveCount(0);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
	await expect(page.getByText('••••').first()).toBeVisible();
	await expect(page.getByText('$1,000.00')).toHaveCount(0);

	await page.getByTestId('page-header').getByRole('button', { name: 'Show amounts' }).click();
	await expect(page.getByText('$1,000.00').first()).toBeVisible();
});
