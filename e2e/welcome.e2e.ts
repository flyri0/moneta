import { expect, test } from '@playwright/test';
import { chooseSelect } from './helpers';
import { onboard } from './helpers';

/**
 * Chromium won't fire a real `beforeinstallprompt` under automation, so the page is handed a
 * stub one. `accept` decides what the user picks in the dialog the stub stands in for.
 */
async function offerInstall(page: Page, accept: boolean): Promise<void> {
	await page.evaluate((accepted) => {
		dispatchEvent(
			Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
				prompt: () => Promise.resolve(),
				userChoice: Promise.resolve({ outcome: accepted ? 'accepted' : 'dismissed' })
			})
		);
	}, accept);
}

test('welcomes a first-time visitor and lets them into the app', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Give every dollar a job.' })).toBeVisible();
	await expect(page.getByText('Free and open source')).toBeVisible();

	await page.getByRole('button', { name: 'Use it in the browser' }).click();
	const warning = page.getByRole('dialog');
	await expect(warning).toContainText('may clear it to free up space');
	await warning.getByRole('button', { name: 'Continue in the browser' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();

	// The choice sticks, so a reload part-way through onboarding doesn't bounce back.
	await page.goto('/');
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('steps aside once a budget exists', async ({ page }) => {
	await onboard(page);
	await page.goto('/');
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
});

test('installs with the browser prompt and then points at the installed app', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Install Moneta' })).toBeVisible();
	await offerInstall(page, true);
	await page.getByRole('button', { name: 'Install Moneta' }).click();

	await expect(page.getByText('Moneta is installed')).toBeVisible();
	// Entering the app from here would take the tab lock the installed window needs.
	await expect(page.getByRole('button', { name: 'Install Moneta' })).toBeHidden();
	await page.getByRole('button', { name: 'Use it here anyway' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('recommends installing to whoever picks the browser', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Install Moneta' })).toBeVisible();
	await offerInstall(page, true);
	await page.getByRole('button', { name: 'Use it in the browser' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Install Moneta' }).click();
	await expect(page.getByText('Moneta is installed')).toBeVisible();
});

test('skips the browser warning when the data is already protected', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator.storage, 'persisted', { value: async () => true });
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Use it in the browser' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('explains how to install by hand when no prompt is offered', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Install Moneta' }).click();
	// Chromium under Playwright never offers the prompt, so the instructions take over.
	await expect(page.getByText('Add to Home Screen')).toBeVisible();
});

// Phones upright and sideways, a tablet, a small laptop and desktops.
const SCREENS = [
	[360, 640],
	[390, 844],
	[844, 390],
	[768, 1024],
	[1024, 600],
	[1280, 720],
	[1440, 900]
] as const;
const INSTALL = { en: 'Install Moneta', 'pt-BR': 'Instalar o Moneta' } as const;

for (const [locale, install] of Object.entries(INSTALL)) {
	for (const [width, height] of SCREENS) {
		test(`keeps the welcome page in one screen at ${width}x${height} in ${locale}`, async ({
			page
		}) => {
			await page.addInitScript((l) => localStorage.setItem('PARAGLIDE_LOCALE', l), locale);
			await page.setViewportSize({ width, height });
			await page.goto('/');
			await expect(page.getByRole('button', { name: install })).toBeInViewport({ ratio: 1 });
			const overflow = await page.evaluate(() => {
				const root = document.documentElement;
				return Math.max(root.scrollHeight - root.clientHeight, root.scrollWidth - root.clientWidth);
			});
			expect(overflow).toBeLessThanOrEqual(0);
		});
	}
}

test('offers the welcome page in Portuguese', async ({ page }) => {
	await page.goto('/');
	await chooseSelect(page, 'Language', 'Português (Brasil)');
	await expect(page.getByRole('button', { name: 'Instalar o Moneta' })).toBeVisible();
	await page.getByRole('button', { name: 'Usar no navegador' }).click();
	await page.getByRole('button', { name: 'Continuar no navegador' }).click();
	await expect(page.getByText('Boas-vindas ao Moneta')).toBeVisible();
});
