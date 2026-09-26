import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import { onboard, openSettings } from './helpers';

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
 * without touching the shared preview server. `nextVersion` changes the bytes of `sw.js` and the
 * revision of `index.html` in its precache list, so installing the new version downloads it again;
 * with `slow`, that download waits for `release()`, like an install over a slow phone connection.
 * Playwright's routing can't do it: it doesn't see the browser fetch the service worker script.
 */
async function serveBuild() {
	let version = 0;
	let slow = false;
	let held: (() => void)[] = [];
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
		if (path === 'sw.js' && version > 0) {
			const source = body
				.toString()
				.replace(/(url:"index\.html",revision:")([^"]+)"/, `$1$2-v${version}"`);
			body = Buffer.from(`${source}\n// ${version}\n`);
		}
		// The page's own navigations come from the precache; the service worker installing fetches it.
		if (slow && path === 'index.html' && req.headers['sec-fetch-dest'] !== 'document') {
			await new Promise<void>((resolve) => held.push(resolve));
		}
		res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
		res.end(body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const release = () => {
		slow = false;
		for (const resolve of held) resolve();
		held = [];
	};
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		nextVersion: (options: { slow?: boolean } = {}) => {
			version++;
			slow = options.slow ?? false;
		},
		release,
		close: () => {
			release();
			server.closeAllConnections();
			return new Promise<void>((resolve) => server.close(() => resolve()));
		}
	};
}

/** Records, across reloads, the calls to the DB worker and the messages to service workers. */
async function recordShutdown(page: Page) {
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
}

/** The recorded log. A read that lands mid-reload throws (the page's context is gone): none. */
async function readLog(page: Page): Promise<string[]> {
	const raw = await page
		.evaluate(() => sessionStorage.getItem('e2e.log') ?? '[]')
		.catch(() => '[]');
	return JSON.parse(raw) as string[];
}

/** Onboards, then reloads so the service worker controls the page: only then can a version wait. */
async function onboardControlled(page: Page) {
	await onboard(page);
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

const available = (page: Page) =>
	page.locator('[data-sonner-toast]', { hasText: 'A new version of Moneta is available.' });
const downloading = (page: Page) =>
	page.locator('[data-sonner-toast]', { hasText: 'Downloading a new version of Moneta' });

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
		await recordShutdown(page);
		await onboardControlled(page);
		await page.evaluate(() => sessionStorage.removeItem('e2e.log'));

		// Deploy a new version: the next update check finds a different service worker.
		server.nextVersion();
		await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
		await available(page).getByRole('button', { name: 'Reload' }).click();

		// The page reloads under the new service worker and opens the budget again.
		await expect.poll(() => readLog(page)).toContain('SKIP_WAITING');
		await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
		const log = await readLog(page);
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
		await onboardControlled(page);

		// Deploy a new version; nothing asks the registration to update but the app itself.
		server.nextVersion();
		await page.evaluate(() => window.dispatchEvent(new Event('online')));
		await expect(available(page)).toBeVisible();
	} finally {
		await context.close();
		await server.close();
	}
});

test('offers a new version when the app opens', async ({ browser }) => {
	const server = await serveBuild();
	const context = await browser.newContext({ baseURL: server.url });
	const page = await context.newPage();
	try {
		await onboardControlled(page);

		// Deploy a new version; only the next launch looks for it.
		server.nextVersion();
		await page.reload();
		await expect(available(page)).toHaveCount(1);
	} finally {
		await context.close();
		await server.close();
	}
});

test('shows a new version while it downloads, then offers it', async ({ browser }) => {
	const server = await serveBuild();
	const context = await browser.newContext({ baseURL: server.url });
	const page = await context.newPage();
	try {
		await onboardControlled(page);

		// A new version that takes a while to download, like on a phone.
		server.nextVersion({ slow: true });
		await page.reload();
		await expect(downloading(page)).toBeVisible();

		server.release();
		await expect(available(page)).toBeVisible();
		await expect(downloading(page)).toHaveCount(0);
	} finally {
		await context.close();
		await server.close();
	}
});

test('installs a version that was downloading when the app opened', async ({ browser }) => {
	const server = await serveBuild();
	const context = await browser.newContext({ baseURL: server.url });
	const page = await context.newPage();
	try {
		await recordShutdown(page);
		await onboardControlled(page);

		// Reload again mid-download: this page registers while the new version is installing.
		server.nextVersion({ slow: true });
		await page.reload();
		await expect(downloading(page)).toBeVisible();
		await page.reload();
		await expect(downloading(page)).toBeVisible();
		await page.evaluate(() => sessionStorage.removeItem('e2e.log'));

		server.release();
		await available(page).getByRole('button', { name: 'Reload' }).click();

		// It takes control and the page reloads right away, not after the 10 s fallback.
		await expect
			.poll(async () => (await readLog(page)).slice(1).includes('system.open'), { timeout: 5000 })
			.toBe(true);
		await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
		const log = await readLog(page);
		expect(log.indexOf('SKIP_WAITING')).toBeLessThan(log.lastIndexOf('system.open'));
	} finally {
		await context.close();
		await server.close();
	}
});

test('checks for a new version from Settings', async ({ browser }) => {
	const server = await serveBuild();
	const context = await browser.newContext({ baseURL: server.url });
	const page = await context.newPage();
	try {
		await onboardControlled(page);
		await openSettings(page);
		const main = page.getByRole('main');

		await main.getByRole('button', { name: 'Check for updates' }).click();
		await expect(main.getByText("You're on the latest version.")).toBeVisible();

		server.nextVersion();
		await main.getByRole('button', { name: 'Check for updates' }).click();
		await expect(main.getByText('A new version of Moneta is available.')).toBeVisible();
		await expect(main.getByRole('button', { name: 'Reload' })).toBeVisible();
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
