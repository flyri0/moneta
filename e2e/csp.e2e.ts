import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { onboard, openSettings, spend } from './helpers';

/** Records every CSP violation on the page in `window.__violations`. */
async function recordViolations(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const list: string[] = [];
		Object.assign(window, { __violations: list });
		document.addEventListener('securitypolicyviolation', (event) => {
			list.push(`${event.effectiveDirective} ${event.blockedURI}`);
		});
	});
}

function violations(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
}

test('ships a restrictive CSP in the HTML', async ({ request }) => {
	const html = await (await request.get('/')).text();
	const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i);
	expect(meta?.[1]).toContain("connect-src 'self'");
	expect(meta?.[1]).toContain("object-src 'none'");
});

test('runs the app without CSP violations', async ({ page }) => {
	await recordViolations(page);
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');
	await page.getByRole('link', { name: 'Reports' }).first().click();
	await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
	// The bar charts live on the full reports.
	await page.getByRole('link', { name: 'Cash flow' }).click();
	await expect(page.getByTestId('cash-flow-chart')).toBeVisible();
	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Spending trends' }).click();
	await expect(page.getByTestId('trends-chart')).toBeVisible();
	await page.getByRole('link', { name: 'Payees' }).first().click();
	await expect(page.getByRole('heading', { name: 'Payees' })).toBeVisible();
	await openSettings(page);
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Back up now' }).click();
	await downloading;
	expect(await violations(page)).toEqual([]);
});

test('blocks requests to other origins', async ({ page }) => {
	await recordViolations(page);
	await page.goto('/');
	const sent = await page.evaluate(() =>
		fetch('https://example.com/').then(
			() => true,
			() => false
		)
	);
	expect(sent).toBe(false);
	await expect.poll(() => violations(page)).toContainEqual(expect.stringMatching(/^connect-src/));
});

/** The Content-Security-Policy `netlify.toml` sends for the paths `for` names. */
async function hostPolicy(path: string): Promise<string> {
	const toml = await readFile('netlify.toml', 'utf8');
	const block = toml.split('[[headers]]').find((b) => b.includes(`for = "${path}"`));
	const policy = block?.match(/Content-Security-Policy = "([^"]*)"/)?.[1];
	if (!policy) throw new Error(`netlify.toml has no Content-Security-Policy for ${path}`);
	return policy;
}

test('the header policy recommended for the database worker lets it run', async ({ page }) => {
	const policy = await hostPolicy('/_app/immutable/workers/*');
	expect(policy).toContain("connect-src 'self'");
	// Serve the worker's scripts with that header, as the host would.
	await page.route('**/_app/immutable/workers/**/*.js', async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			headers: { ...response.headers(), 'content-security-policy': policy }
		});
	});
	await onboard(page);
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
});
