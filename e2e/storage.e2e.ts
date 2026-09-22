import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Makes reading `window.localStorage` throw, as Chromium does when site data is blocked or in a
 * sandboxed iframe. Only the property read throws: OPFS stays usable, so the app can still start.
 */
async function blockLocalStorage(page: Page): Promise<void> {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('The operation is insecure.', 'SecurityError');
			}
		});
	});
}

test('opens and budgets without localStorage', async ({ page }) => {
	const errors: Error[] = [];
	page.on('pageerror', (err) => errors.push(err));
	await blockLocalStorage(page);

	await onboard(page);

	// Nothing is remembered between loads, so `/` can't tell a budget exists and welcomes again,
	// but the budget itself is found from the files.
	await page.goto('/');
	await page.getByRole('button', { name: 'Use it in the browser' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	expect(errors).toEqual([]);
});
