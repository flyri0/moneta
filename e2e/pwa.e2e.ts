import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.wasm': 'application/wasm',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon'
};

/**
 * Serves ./build like `pnpm preview`, on its own origin, so a test can deploy a new version
 * (`nextVersion` changes the bytes of `sw.js`) without touching the shared preview server.
 * Playwright's routing can't do it: it doesn't see the browser fetch the service worker script.
 */
async function serveBuild() {
	let version = 0;
	const server = createServer(async (req, res) => {
		const path = normalize(new URL(req.url!, 'http://x').pathname).replace(/^\/+/, '');
		let file = join('build', path || 'index.html');
		let body = await readFile(file).catch(() => null);
		if (!body) {
			// SPA fallback, like `sirv --single`.
			file = join('build', 'index.html');
			body = await readFile(file);
		}
		const type = TYPES[extname(file)] ?? 'application/octet-stream';
		if (path === 'sw.js' && version > 0)
			body = Buffer.concat([body, Buffer.from(`\n// ${version}\n`)]);
		res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
		res.end(body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		nextVersion: () => void version++,
		close: () => new Promise<void>((resolve) => server.close(() => resolve()))
	};
}

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

test('closes the database before installing an update, then reopens it', async ({ browser }) => {
	const server = await serveBuild();
	const context = await browser.newContext({ baseURL: server.url });
	const page = await context.newPage();
	try {
		// Record, across the reload, the calls to the DB worker and the messages to service workers.
		await page.addInitScript(() => {
			const log = (entry: string) => {
				const entries = JSON.parse(sessionStorage.getItem('e2e.log') ?? '[]') as string[];
				sessionStorage.setItem('e2e.log', JSON.stringify([...entries, entry]));
			};
			const toWorker = Worker.prototype.postMessage;
			Worker.prototype.postMessage = function (this: Worker, ...args: [unknown, never]) {
				const method = (args[0] as { method?: string } | null)?.method;
				if (method?.startsWith('system.')) log(method);
				return toWorker.apply(this, args);
			};
			const toServiceWorker = ServiceWorker.prototype.postMessage;
			ServiceWorker.prototype.postMessage = function (
				this: ServiceWorker,
				...args: [unknown, never]
			) {
				const type = (args[0] as { type?: string } | null)?.type;
				if (type) log(type);
				return toServiceWorker.apply(this, args);
			};
		});
		await onboard(page);
		// A new version only waits while the current one controls a page: reload to be controlled.
		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});
		await page.reload();
		await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
		expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
		await page.evaluate(() => sessionStorage.removeItem('e2e.log'));

		// Deploy a new version: the next update check finds a different service worker.
		server.nextVersion();
		await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
		await page
			.locator('[data-sonner-toast]', { hasText: 'A new version of Moneta is available.' })
			.getByRole('button', { name: 'Reload' })
			.click();

		// The page reloads under the new service worker and opens the budget again.
		await expect
			.poll(() => page.evaluate(() => sessionStorage.getItem('e2e.log') ?? '[]'))
			.toContain('SKIP_WAITING');
		await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
		const log = JSON.parse(
			await page.evaluate(() => sessionStorage.getItem('e2e.log') ?? '[]')
		) as string[];
		const skip = log.indexOf('SKIP_WAITING');
		expect(log.slice(0, skip)).toContain('system.release');
		expect(log.slice(skip)).toContain('system.open');
		expect(
			await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.getRegistration();
				return {
					waiting: !!registration?.waiting,
					controlled: !!navigator.serviceWorker.controller
				};
			})
		).toEqual({ waiting: false, controlled: true });
	} finally {
		await context.close();
		await server.close();
	}
});

test('looks for a new version when the connection comes back', async ({ browser }) => {
	const server = await serveBuild();
	const context = await browser.newContext({ baseURL: server.url });
	const page = await context.newPage();
	try {
		await onboard(page);
		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});
		await page.reload();
		await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');

		// Deploy a new version; nothing asks the registration to update but the app itself.
		server.nextVersion();
		await page.evaluate(() => window.dispatchEvent(new Event('online')));
		await expect(
			page.locator('[data-sonner-toast]', { hasText: 'A new version of Moneta is available.' })
		).toBeVisible();
	} finally {
		await context.close();
		await server.close();
	}
});

test('can be installed', async ({ page }) => {
	await page.goto('/');
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	const manifest = await (await page.request.get(href!)).json();
	expect(manifest).toMatchObject({ name: 'Moneta', display: 'standalone', start_url: '/budget' });
	const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
	expect(purposes).toContain('maskable');
	for (const icon of manifest.icons) {
		expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
	}
});

test('starts the installed app at the current month', async ({ page }) => {
	await onboard(page);
	// start_url: the installed window goes here, never to the welcome page.
	await page.goto('/budget');
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
});
