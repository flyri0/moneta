import { expect, test, type Page } from '@playwright/test';
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
	await expect(page.getByRole('heading', { name: 'Moneta' })).toBeVisible();
	await expect(page.getByText('Free and open source')).toBeVisible();

	await page.getByRole('button', { name: 'Use it in the browser' }).click();
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

test('explains how to install by hand when no prompt is offered', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Install Moneta' }).click();
	// Chromium under Playwright never offers the prompt, so the instructions take over.
	await expect(page.getByText('Add to Home Screen')).toBeVisible();
});

test('keeps the welcome page in one screen on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 640 });
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Install Moneta' })).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollHeight - document.documentElement.clientHeight
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('offers the welcome page in Portuguese', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Language').selectOption('pt-BR');
	await expect(page.getByRole('button', { name: 'Instalar o Moneta' })).toBeVisible();
	await page.getByRole('button', { name: 'Usar no navegador' }).click();
	await expect(page.getByText('Boas-vindas ao Moneta')).toBeVisible();
});
