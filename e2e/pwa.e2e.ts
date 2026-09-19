import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('keeps working offline after the first load', async ({ page, context }) => {
	await onboard(page);
	// The service worker precaches the app (including SQLite's WebAssembly) on install.
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await page.goto('/accounts');
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
});

test('can be installed', async ({ page }) => {
	await page.goto('/');
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	const manifest = await (await page.request.get(href!)).json();
	expect(manifest).toMatchObject({ name: 'Moneta', display: 'standalone', start_url: '/' });
	const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
	expect(purposes).toContain('maskable');
	for (const icon of manifest.icons) {
		expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
	}
});
