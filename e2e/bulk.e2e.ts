import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, onboard, spend } from './helpers';

async function openChecking(page: Page) {
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
}

async function withThree(page: Page) {
	await onboard(page);
	await spend(page, 'Market', '10', 'Groceries');
	await spend(page, 'Bakery', '20', 'Groceries');
	await spend(page, 'Cafe', '30', 'Groceries');
	await openChecking(page);
	await expect(page.getByTestId('register-row')).toHaveCount(4);
}

test('changes the category of several transactions, then clears them', async ({ page }) => {
	await withThree(page);
	const rows = page.getByTestId('register-row');
	const toasts = page.getByRole('region', { name: /Notifications/ });

	await page.getByRole('button', { name: 'Select', exact: true }).click();
	const bar = page.getByTestId('selection-bar');
	await page.getByRole('checkbox', { name: 'Select Market, -$10.00' }).click();
	await rows.filter({ hasText: 'Bakery' }).getByText('Bakery').click();
	await expect(bar.getByTestId('selection-count')).toHaveText('Selected: 2');

	await bar.getByRole('button', { name: 'Category' }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Category', 'Household', 'Household');
	await dialog.getByRole('button', { name: 'Apply' }).click();
	await expect(dialog).toBeHidden();
	await expect(toasts).toContainText('Transactions changed: 2.');
	// The action ends the selection and marks the rows it changed.
	await expect(bar).toBeHidden();
	await expect(rows.filter({ hasText: 'Market' })).toHaveAttribute('data-highlighted', 'true');
	await expect(rows.filter({ hasText: 'Market' })).toContainText('Household');
	await expect(rows.filter({ hasText: 'Bakery' })).toContainText('Household');
	await expect(rows.filter({ hasText: 'Cafe' })).toContainText('Groceries');

	// Cleared or not stays in sight while choosing, and one button flips it.
	const cleared = (payee: string) =>
		rows.filter({ hasText: payee }).getByRole('button', { name: 'Cleared' });
	await page.getByRole('button', { name: 'Select', exact: true }).click();
	await rows.filter({ hasText: 'Market' }).click();
	await rows.filter({ hasText: 'Bakery' }).click();
	await expect(cleared('Market')).toBeVisible();
	await bar.getByRole('button', { name: 'Clear', exact: true }).click();
	await expect(bar).toBeHidden();
	await expect(cleared('Market')).toHaveAttribute('aria-pressed', 'true');
	await expect(cleared('Bakery')).toHaveAttribute('aria-pressed', 'true');
	await expect(cleared('Cafe')).toHaveAttribute('aria-pressed', 'false');

	await page.getByRole('button', { name: 'Select', exact: true }).click();
	await rows.filter({ hasText: 'Market' }).click();
	await bar.getByRole('button', { name: 'Unclear' }).click();
	await expect(cleared('Market')).toHaveAttribute('aria-pressed', 'false');
	await expect(cleared('Bakery')).toHaveAttribute('aria-pressed', 'true');
});

test('deletes several transactions and brings them back', async ({ page }) => {
	await withThree(page);
	const rows = page.getByTestId('register-row');

	await page.getByRole('button', { name: 'Select', exact: true }).click();
	const bar = page.getByTestId('selection-bar');
	await bar.getByRole('button', { name: 'Select all' }).click();
	await expect(bar.getByTestId('selection-count')).toHaveText('Selected: 4');
	await bar.getByRole('button', { name: 'Select none' }).click();
	await expect(bar.getByTestId('selection-count')).toHaveText('Selected: 0');
	await bar.getByRole('button', { name: 'Select all' }).click();
	await page.getByRole('checkbox', { name: /^Select Starting balance/ }).click();
	await bar.getByRole('button', { name: 'Delete' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('Delete 3 transactions?');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toBeHidden();
	await expect(rows).toHaveCount(1);
	await expect(bar).toBeHidden();

	const toasts = page.getByRole('region', { name: /Notifications/ });
	await expect(toasts).toContainText('Transactions deleted: 3.');
	await toasts.getByRole('button', { name: 'Undo' }).click();
	await expect(rows).toHaveCount(4);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps the bar above the bottom bar, in place of the add button', async ({ page }) => {
		await withThree(page);
		const fab = page.locator('button[data-compact]');
		await expect(fab).toBeVisible();
		await page.getByRole('button', { name: 'Select', exact: true }).click();
		const bar = page.getByTestId('selection-bar');
		await expect(bar).toBeVisible();
		await expect(fab).toBeHidden();

		const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
		const box = await bar.boundingBox();
		expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(390);
		// Every action says what it does.
		for (const name of ['Category', 'Date', 'Clear', 'Delete'])
			await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
	});
});

test.describe('with a touch screen', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('holding a transaction starts selecting with it', async ({ page }) => {
		await withThree(page);
		const row = page.getByTestId('register-row').filter({ hasText: 'Cafe' });
		const box = (await row.boundingBox())!;
		const point = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
		const touch = { ...point, pointerType: 'touch', isPrimary: true, bubbles: true };
		await row.dispatchEvent('pointerdown', touch);
		await page.waitForTimeout(600);
		await row.dispatchEvent('pointerup', touch);
		await row.dispatchEvent('click', { ...point, bubbles: true });

		const bar = page.getByTestId('selection-bar');
		await expect(bar.getByTestId('selection-count')).toHaveText('Selected: 1');
		await expect(page.getByRole('checkbox', { name: /^Select Cafe/ })).toBeChecked();
		// The release didn't open the transaction, nor take the row back.
		await expect(page.getByRole('dialog')).toBeHidden();
	});
});

test.describe('on a narrow desktop', () => {
	test.use({ viewport: { width: 900, height: 800 } });

	test('fits the bar in the column', async ({ page }) => {
		await withThree(page);
		await page.getByRole('button', { name: 'Select', exact: true }).click();
		const bar = page.getByTestId('selection-bar');
		await expect(bar).toBeVisible();
		const fits = await bar.evaluate((node) => {
			const inner = [...node.querySelectorAll('*')].every(
				(child) => child.scrollWidth <= child.clientWidth || child.clientWidth === 0
			);
			const page = document.documentElement.scrollWidth <= window.innerWidth;
			return inner && node.scrollWidth <= node.clientWidth && page;
		});
		expect(fits).toBe(true);
	});
});
