import { expect, test } from '@playwright/test';
import { chooseCombobox, fillNewBudget, onboard, openSettings } from './helpers';

test('creates, switches, renames and deletes budgets', async ({ page }) => {
	await onboard(page);
	await openSettings(page);

	await page.getByRole('button', { name: 'New budget' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

	await page.getByRole('button', { name: 'New budget' }).click();
	await fillNewBudget(page, 'Work', '250');
	await expect(page.getByTestId('rta-amount')).toHaveText('$250.00');

	await openSettings(page);
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Work/]);
	await page.getByRole('button', { name: 'Open Home' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');

	await openSettings(page);
	await page.getByLabel('Budget name').fill('House');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(files.getByRole('listitem').first()).toContainText('House');

	await page.getByRole('button', { name: 'Delete Work' }).click();
	await page.getByRole('button', { name: 'Tap again to delete' }).click();
	await expect(files.getByRole('listitem')).toHaveText([/House/]);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(files.getByRole('listitem')).toHaveText([/House/]);
});

test('keeps the currency once the budget has amounts', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await chooseCombobox(page, 'Currency', 'Japanese Yen (JPY)', 'JPY');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('alert')).toContainText('same number of decimal places');
	await chooseCombobox(page, 'Currency', 'Euro (EUR)', 'EUR');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('link', { name: 'Budget' }).first().click();
	await expect(page.getByTestId('rta-amount')).toHaveText('€1,000.00');
});

test('deleting the last budget starts over', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await page.getByRole('button', { name: 'Delete Home' }).click();
	await page.getByRole('button', { name: 'Tap again to delete' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
});

test('picks an accent colour and a theme that outlive a reload', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'teal');

	await page.getByRole('button', { name: 'Violet' }).click();
	await page.getByRole('button', { name: 'Dark' }).click();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);
	await expect(page.getByRole('button', { name: 'Violet' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('picks an accent colour from a sheet', async ({ page }) => {
		await onboard(page);
		await openSettings(page);
		// The swatches only fit in a sheet, so the row shows the current colour and opens one.
		await expect(page.getByRole('button', { name: 'Amber' })).toBeHidden();

		await page.getByRole('button', { name: 'Accent color' }).click();
		await page.getByRole('button', { name: 'Amber' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber');
		await expect(page.getByRole('button', { name: 'Accent color' })).toContainText('Amber');
	});
});
