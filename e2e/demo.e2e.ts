import { expect, test } from '@playwright/test';
import { categoryRow, openSettings, useInBrowser } from './helpers';

const BANNER = 'Demo data. Nothing here is saved.';

async function tryDemo(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('button', { name: 'Try the demo' }).click();
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(page.getByText(BANNER)).toBeVisible();
}

test('fills a throwaway budget with data and says so', async ({ page }) => {
	await tryDemo(page);

	// A budget that has been lived in: everything assigned, and money in the accounts.
	await expect(page.getByTestId('rta-amount')).toHaveText('$0.00');
	await expect(categoryRow(page, 'Groceries')).toBeVisible();
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	// The sidebar lists the accounts too, so scope to the page or the row matches twice.
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Credit Card' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-title')).toHaveText('Credit Card');
	await expect(
		page.getByTestId('register-row').filter({ hasText: 'Corner Market' })
	).not.toHaveCount(0);

	// A reload must not drop the visitor into onboarding.
	await page.reload();
	await expect(page.getByText(BANNER)).toBeVisible();
});

test('vanishes on the way back to the welcome page', async ({ page }) => {
	await tryDemo(page);

	await page.goBack();
	await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible();

	await useInBrowser(page);
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('client-side navigation to / and back does not block the app', async ({ page }) => {
	await tryDemo(page);

	await page.goBack();
	await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible();

	await page.goForward();
	await expect(page.getByText('Moneta is open in another tab')).toBeHidden();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('hands the visitor over to a real budget from the banner', async ({ page }) => {
	await tryDemo(page);

	await page.getByRole('button', { name: 'Create my budget' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	// Nothing to go back to, so this is the full first-run flow.
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
});

test('keeps the sticky budget header clear of the banner', async ({ page }) => {
	await tryDemo(page);

	const banner = page.getByText(BANNER);
	const header = page.getByTestId('group-row').first();
	await expect(header).toBeVisible();
	const [bannerBox, headerBox] = [await banner.boundingBox(), await header.boundingBox()];
	expect(headerBox!.y).toBeGreaterThanOrEqual(bannerBox!.y + bannerBox!.height - 1);
});

test('turns backups and exports off in Settings', async ({ page }) => {
	await tryDemo(page);
	await openSettings(page);

	await expect(page.getByTestId('backup-demo')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Back up now' })).toBeDisabled();
	await expect(page.getByLabel('Restore from a backup')).toBeDisabled();
	await expect(page.getByRole('button', { name: /Connect Google Drive/ })).toBeDisabled();
	await expect(page.getByRole('switch', { name: 'Encrypt backups' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Transactions (CSV)' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Whole budget (JSON)' })).toBeDisabled();
});
