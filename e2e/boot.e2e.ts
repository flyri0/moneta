import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Until the budget screen exists (next task), an open budget shows the placeholder home page.
const HOME = 'The app shell arrives in Plan 2.';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await expect(page.getByText(HOME)).toBeVisible();
	await page.reload();
	await expect(page.getByText(HOME)).toBeVisible();
	const registry = await page.evaluate(() => localStorage.getItem('moneta.registry'));
	expect(JSON.parse(registry ?? '{}').budgets).toEqual([expect.objectContaining({ name: 'Home' })]);
});

test('a second tab waits until it takes over', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);
	await expect(first.getByText(HOME)).toBeVisible();

	const second = await context.newPage();
	await second.goto('/');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await second.getByRole('button', { name: 'Use Moneta here' }).click();
	await expect(second.getByText(HOME)).toBeVisible();
	await expect(first.getByText('Moneta is open in another tab')).toBeVisible();
});
