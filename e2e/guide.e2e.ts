import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { categoryRow, onboard, openSettings } from './helpers';

test('serves the guide as plain pages, with no CSP violations', async ({ page }) => {
	const violations: string[] = [];
	page.on('console', (message) => {
		if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
	});
	await page.goto('/guide/');
	await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Contents' })
		.getByRole('link', { name: 'How the budget works' })
		.click();
	await expect(page).toHaveURL(/\/guide\/budgeting\/$/);
	await expect(page.locator('#ready-to-assign')).toBeVisible();

	await page.getByRole('link', { name: 'Português (BR)' }).click();
	await expect(page).toHaveURL(/\/guide\/pt-BR\/budgeting\/$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Como o orçamento funciona' })
	).toBeVisible();
	expect(violations).toEqual([]);
});

test('keeps the guide out of the precache', async () => {
	const sw = await readFile('build/sw.js', 'utf8');
	expect(sw).toContain('index.html');
	expect(sw).not.toMatch(/url:"guide\//);
});

test('reaches the guide from the network under the service worker', async ({ page }) => {
	await onboard(page);
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

	// Without its exception, the service worker would answer with the app's index.html.
	await page.goto('/guide/faq/');
	await expect(page.getByRole('heading', { level: 1, name: 'Troubleshooting' })).toBeVisible();
	const cached = await page.evaluate(async () => {
		const urls: string[] = [];
		for (const name of await caches.keys()) {
			for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
		}
		return urls;
	});
	expect(cached.length).toBeGreaterThan(0);
	expect(cached.filter((url) => url.includes('/guide/'))).toEqual([]);
});

test('links to the guide from Settings and from the budget', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('rta-card').getByRole('button').first().click();
	await expect(page.getByTestId('rta-card').getByTestId('help-link')).toHaveAttribute(
		'href',
		'/guide/budgeting/#ready-to-assign'
	);

	await categoryRow(page, 'Groceries').first().click();
	await expect(
		page.getByRole('dialog').getByRole('link', { name: 'Learn more in the guide' })
	).toHaveAttribute('href', '/guide/budgeting/#carryover');
	await page.keyboard.press('Escape');

	await openSettings(page);
	const row = page.getByRole('link', { name: /User guide/ });
	await expect(row).toHaveAttribute('href', '/guide/');
	await expect(row).toHaveAttribute('target', '_blank');
});
