import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('lists the transactions of every account', async ({ page }) => {
	await onboard(page);
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await expect(sidebar.getByRole('link')).toHaveText([
		'Budget',
		'Transactions',
		'Accounts',
		'Reports',
		'Payees',
		'Schedules',
		'Settings'
	]);

	await sidebar.getByRole('link', { name: 'Accounts' }).click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByLabel('Account name').fill('Rainy day');
	await dialog.getByLabel('Current balance').fill('250');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	const rows = page.getByTestId('register-row');
	await expect(rows).toHaveCount(2);
	await expect(rows.filter({ hasText: 'Checking' })).toContainText('$1,000.00');
	await expect(rows.filter({ hasText: 'Rainy day' })).toContainText('$250.00');

	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('No transactions.')).toBeVisible();
	// The account's own name, any case, and amounts match too.
	await page.getByRole('searchbox').fill('RAINY');
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Rainy day');
	await page.getByRole('searchbox').fill('1,000');
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Checking');
	await page.getByRole('searchbox').fill('');
	await expect(rows).toHaveCount(2);

	await rows
		.filter({ hasText: 'Rainy day' })
		.getByRole('button', { name: 'Starting balance' })
		.click();
	await expect(dialog).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps Payees, Schedules and Settings in the More menu', async ({ page }) => {
		await onboard(page);
		const bar = page.getByRole('navigation', { name: 'Main' });
		await expect(bar.locator('[data-nav-label]')).toHaveText([
			'Budget',
			'Transactions',
			'Accounts',
			'Reports',
			'More'
		]);

		await bar.getByRole('link', { name: 'Transactions' }).click();
		await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();

		await bar.getByRole('button', { name: 'More' }).click();
		await expect(page.getByRole('dialog').getByRole('link')).toHaveText([
			'Payees',
			'Schedules',
			'Settings'
		]);
		await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(bar.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
	});

	test('shrinks the add-transaction button to its icon on scroll', async ({ page }) => {
		await onboard(page);
		const add = page.getByRole('button', { name: 'Transaction', exact: true });
		const label = add.locator('[data-fab-label]');
		await expect(label).toBeVisible();

		await page.evaluate(() => window.scrollTo(0, 200));
		await expect(add).toHaveAttribute('data-compact', 'true');
		await expect(label).toBeHidden();

		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(label).toBeVisible();

		// A short page opened from a scrolled one starts at the top, with the label back.
		await page.evaluate(() => window.scrollTo(0, 200));
		await expect(label).toBeHidden();
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('link', { name: 'Transactions' })
			.click();
		await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
		await expect(label).toBeVisible();

		await add.click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});
});
