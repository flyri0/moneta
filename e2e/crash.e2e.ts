import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Makes money formatting throw once `moneta.e2e.crash` is set, as an unknown currency in a
 * budget's meta does (Intl rejects it with a RangeError).
 */
async function breakMoneyFormatting(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		const Original = Intl.NumberFormat;
		const Broken = function (this: unknown, ...args: ConstructorParameters<typeof Original>) {
			const options = args[1];
			if (localStorage.getItem('moneta.e2e.crash') && options?.style === 'currency')
				throw new RangeError('Invalid currency code : ZZZ');
			return new Original(...args);
		} as unknown as typeof Intl.NumberFormat;
		Broken.supportedLocalesOf = Original.supportedLocalesOf;
		Intl.NumberFormat = Broken;
	});
}

test('a screen that fails to render leaves a way to Settings', async ({ page }) => {
	await breakMoneyFormatting(page);
	await onboard(page);
	await page.evaluate(() => localStorage.setItem('moneta.e2e.crash', '1'));
	await page.reload();

	const crash = page.getByTestId('crash-screen');
	await expect(crash).toBeVisible();
	await expect(crash.getByRole('alert')).toBeVisible();
	await crash.getByRole('button', { name: 'Go to Settings' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(page.getByLabel('Budget name')).toHaveValue('Home');
});
