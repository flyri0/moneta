import { expect, test, type Locator, type Page } from '@playwright/test';
import { onboard } from './helpers';

/** Drags a drawer by its grab bar, `by` px down (up if negative), too slowly to be a flick. */
async function drag(page: Page, drawer: Locator, by: number): Promise<void> {
	const box = (await drawer.locator('[data-slot="drawer-handle"]').boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y + by, { steps: Math.ceil(Math.abs(by) / 4) });
	await page.waitForTimeout(150);
	await page.mouse.up();
}

/** Whether `element` is what a tap at its centre would hit, which visually hidden ones aren't. */
async function onScreen(element: Locator): Promise<boolean> {
	return element.evaluate((el) => {
		const box = el.getBoundingClientRect();
		return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
	});
}

async function openAdd(page: Page): Promise<Locator> {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const drawer = page.getByRole('dialog', { name: 'New transaction' });
	await expect(drawer).toBeVisible();
	return drawer;
}

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('a dialog is a drawer: dragged down it closes, nudged it springs back', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).first().click();
		await page.getByRole('button', { name: 'Add account' }).click();
		const drawer = page.getByRole('dialog', { name: 'Add account' });
		await expect(drawer).toBeVisible();

		// Swiping replaces the corner X, which stays only for screen readers.
		expect(await onScreen(drawer.getByRole('button', { name: 'Close' }))).toBe(false);

		await drag(page, drawer, 40);
		await expect(drawer).toBeVisible();
		await expect
			.poll(() => drawer.evaluate((el) => getComputedStyle(el).transform))
			.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);

		await drag(page, drawer, 400);
		await expect(drawer).toBeHidden();
	});

	test('a drawer with more than fits fills the screen when dragged up', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 520 });
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).first().click();
		await page.getByRole('button', { name: 'Add account' }).click();
		const drawer = page.getByRole('dialog', { name: 'Add account' });
		await expect(drawer).toBeVisible();
		// Rounded: the CI's renderer lands a fraction of a pixel off.
		const height = async () => Math.round((await drawer.boundingBox())!.height);
		const natural = await height();
		expect(natural).toBeLessThan(520);

		await drag(page, drawer, -150);
		await expect(drawer).toHaveAttribute('data-expanded');
		await expect.poll(height).toBe(520);

		// Down from there it goes back to its height first, then closes.
		await drag(page, drawer, 120);
		await expect(drawer).not.toHaveAttribute('data-expanded');
		await expect.poll(height).toBe(natural);
		await drag(page, drawer, 300);
		await expect(drawer).toBeHidden();
	});

	test('opening a drawer never shows its hidden Close', async ({ page }) => {
		await onboard(page);
		// The transaction dialog opens before its form loads, with nothing else to focus.
		const drawer = await openAdd(page);
		const close = drawer.getByRole('button', { name: 'Close' });
		await expect(close).not.toBeFocused();
		expect(await onScreen(close)).toBe(false);
	});

	test('Escape still closes a drawer', async ({ page }) => {
		await onboard(page);
		const drawer = await openAdd(page);
		await page.keyboard.press('Escape');
		await expect(drawer).toBeHidden();
	});
});

test('a dialog on a desktop keeps its close button', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Add account' });
	await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
	await expect(dialog.locator('[data-slot="drawer-handle"]')).toHaveCount(0);
});
