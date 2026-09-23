import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('shows a not-found page instead of onboarding in a new browser', async ({ page }) => {
	await page.goto('/nowhere');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByText('Welcome to Moneta')).toHaveCount(0);

	await page.getByRole('link', { name: 'Go to start' }).click();
	await expect(page.getByRole('button', { name: 'Use it in the browser' })).toBeVisible();
});

test('shows the not-found page outside the app and leads back to the budget', async ({ page }) => {
	await onboard(page);
	await page.goto('/nowhere');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Go to start' }).click();
	await expect(page.getByTestId('rta-amount')).toBeVisible();
});
