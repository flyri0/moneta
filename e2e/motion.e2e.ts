import { expect, test } from '@playwright/test';
import { chooseCombobox, chooseSelect, onboard, openSettings } from './helpers';

test.describe('with motion allowed by the system', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('animates screen changes and lights up the transaction just saved', async ({ page }) => {
		await onboard(page);
		const html = page.locator('html');
		await expect(html).toHaveAttribute('data-motion', 'full');

		// Count the screen changes that animate.
		await page.evaluate(() => {
			const start = document.startViewTransition.bind(document);
			const w = window as unknown as { transitions: number };
			w.transitions = 0;
			document.startViewTransition = (update) => {
				w.transitions++;
				return start(update);
			};
		});
		const transitions = () =>
			page.evaluate(() => (window as unknown as { transitions: number }).transitions);

		const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
		await sidebar.getByRole('link', { name: 'Schedules' }).click();
		await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
		await sidebar.getByRole('link', { name: 'Accounts' }).click();
		await page
			.getByRole('main')
			.getByTestId('account-row')
			.filter({ hasText: 'Checking' })
			.getByRole('link')
			.click();
		await expect(page.getByTestId('register-title')).toHaveText('Checking');
		// A fade to Schedules, a fade to Accounts, a slide into the account.
		expect(await transitions()).toBe(3);
		// The animation ends and takes its marker with it.
		await expect(html).not.toHaveAttribute('data-nav');

		await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		await chooseCombobox(dialog, 'Payee', 'Market', 'Market');
		await dialog.getByLabel('Amount', { exact: true }).fill('20');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();
		const row = page.getByTestId('register-row').filter({ hasText: 'Market' });
		await expect(row).toHaveAttribute('data-fresh', 'true');
		await expect(row).toHaveAttribute('data-fresh', 'false');
	});

	test('keeps motion down once Settings asks for it, across reloads', async ({ page }) => {
		await onboard(page);
		await openSettings(page);
		await chooseSelect(page, 'Animations', 'Reduced');
		await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');

		await chooseSelect(page, 'Animations', 'Match the system');
		await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
	});
});

test('follows the system asking for reduced motion', async ({ page }) => {
	await onboard(page);
	await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
	await openSettings(page);
	await expect(page.getByLabel('Animations')).toHaveText('Match the system');
});
