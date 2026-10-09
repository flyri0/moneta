import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

const eye = (page: Page) => page.getByTestId('hide-amounts');

test('the eye hides amounts on every screen and remembers it', async ({ page }) => {
	await onboard(page);
	const rta = page.getByTestId('rta-amount');

	await page.getByTestId('page-header').getByRole('button', { name: 'Hide amounts' }).click();
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

for (const [device, viewport] of [
	['on a phone', { width: 390, height: 844 }],
	['on desktop', { width: 1280, height: 800 }]
] as const) {
	test(`keeps the eye in one place, and off pages without money, ${device}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await onboard(page);
		await expect(eye(page)).toBeVisible();
		const home = await eye(page).boundingBox();

		/** Where the eye is once `heading` shows. */
		async function eyeOn(heading: string) {
			await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
			return eye(page).boundingBox();
		}

		await page.getByRole('link', { name: 'Accounts' }).first().click();
		expect(await eyeOn('Accounts')).toEqual(home);
		await page.getByRole('main').getByTestId('account-row').getByRole('link').first().click();
		await expect(page.getByTestId('register-title')).toBeVisible();
		expect(await eye(page).boundingBox()).toEqual(home);
		await page.getByRole('link', { name: 'Transactions' }).first().click();
		expect(await eyeOn('Transactions')).toEqual(home);
		await page.getByRole('link', { name: 'Reports' }).first().click();
		expect(await eyeOn('Reports')).toEqual(home);

		await page.getByRole('link', { name: 'Settings' }).first().click();
		await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
		await expect(eye(page)).toHaveCount(0);
		await page.goto('/payees');
		await expect(page.getByRole('heading', { name: 'Payees', exact: true })).toBeVisible();
		await expect(eye(page)).toHaveCount(0);
	});
}

test('hides the Available shown in category pickers', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('page-header').getByRole('button', { name: 'Hide amounts' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('••••');
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	await page.getByRole('dialog').getByLabel('Category', { exact: true }).click();
	const groceries = page
		.locator('[data-picker][data-state="open"] [data-slot="command-item"]')
		.filter({ hasText: 'Groceries' });
	await expect(groceries.getByTestId('available')).toHaveText('••••');
});
