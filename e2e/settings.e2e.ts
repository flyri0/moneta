import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, deleteBudget, fillNewBudget, onboard, openSettings } from './helpers';

test('creates, switches, renames and deletes budgets', async ({ page }) => {
	await onboard(page);
	await openSettings(page);

	await page.getByRole('button', { name: 'New budget' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

	await page.getByRole('button', { name: 'New budget' }).click();
	await fillNewBudget(page, 'Work', '250');
	await expect(page.getByTestId('rta-amount')).toHaveText('$250.00');

	await openSettings(page);
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Work/]);
	await page.getByRole('button', { name: 'Open Home' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');

	await openSettings(page);
	await page.getByLabel('Budget name').fill('House');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(files.getByRole('listitem').first()).toContainText('House');

	await deleteBudget(page, 'Work');
	await expect(files.getByRole('listitem')).toHaveText([/House/]);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(files.getByRole('listitem')).toHaveText([/House/]);
});

test('keeps the currency once the budget has amounts', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await chooseCombobox(page, 'Currency', 'Japanese Yen (JPY)', 'JPY');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('alert')).toContainText('same number of decimal places');
	await chooseCombobox(page, 'Currency', 'Euro (EUR)', 'EUR');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('link', { name: 'Budget' }).first().click();
	await expect(page.getByTestId('rta-amount')).toHaveText('€1,000.00');
});

test('deleting the last budget starts over', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await deleteBudget(page, 'Home');
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeHidden();
});

test('deleting a budget needs its name and a second tap after a wait', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await page.getByRole('button', { name: 'Delete Home' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('status')).toContainText('deletes Home and its saved copies');
	const name = dialog.getByLabel('Type Home to confirm');
	const confirm = dialog.getByRole('button', { name: 'Delete budget' });

	// Only the exact name unlocks the button.
	await expect(confirm).toBeDisabled();
	await name.fill('home');
	await expect(confirm).toBeDisabled();
	await name.fill('Home');
	await expect(confirm).toBeEnabled();

	// The first tap starts a wait; changing the name starts over.
	await confirm.click();
	await expect(dialog.getByRole('button', { name: /^Delete in \ds$/ })).toBeDisabled();
	await name.fill('Hom');
	await expect(confirm).toBeDisabled();
	await name.fill('Home');
	await confirm.click();

	// Closing without the second tap keeps the budget.
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('budget-files').getByRole('listitem')).toHaveText([/Home/]);

	await deleteBudget(page, 'Home');
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('picks an accent colour and a theme that outlive a reload', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'teal');

	await page.getByRole('button', { name: 'Violet' }).click();
	await page.getByRole('button', { name: 'Dark' }).click();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);
	await expect(page.getByRole('button', { name: 'Violet' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('links to the source code', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	const source = page.getByRole('link', { name: 'Source code' });
	await expect(source).toHaveAttribute('href', 'https://github.com/flyri0/moneta');
	await expect(source).toHaveAttribute('target', '_blank');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('picks an accent colour from a sheet', async ({ page }) => {
		await onboard(page);
		await openSettings(page);
		// The swatches only fit in a sheet, so the row shows the current colour and opens one.
		await expect(page.getByRole('button', { name: 'Amber' })).toBeHidden();

		await page.getByRole('button', { name: 'Accent color' }).click();
		await page.getByRole('button', { name: 'Amber' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber');
		await expect(page.getByRole('button', { name: 'Accent color' })).toContainText('Amber');
	});
});

interface PersistenceStub {
	persisted: boolean;
	/** The persistent-storage permission; null makes the query reject, as Safari does. */
	permission: PermissionState | null;
	/** Whether persist() grants. */
	grants: boolean;
}

/** Replaces what the page reads about persistent storage with `window.persistence`. */
async function stubPersistence(page: Page, stub: PersistenceStub): Promise<void> {
	await page.addInitScript((initial) => {
		const s = initial;
		(window as unknown as { persistence: typeof s }).persistence = s;
		Object.defineProperty(navigator.storage, 'persisted', {
			configurable: true,
			value: async () => s.persisted
		});
		Object.defineProperty(navigator.storage, 'persist', {
			configurable: true,
			value: async () => {
				if (s.grants) s.persisted = true;
				return s.persisted;
			}
		});
		const query = navigator.permissions.query.bind(navigator.permissions);
		Object.defineProperty(navigator.permissions, 'query', {
			configurable: true,
			value: async (descriptor: PermissionDescriptor) => {
				if (descriptor.name !== 'persistent-storage') return query(descriptor);
				if (s.permission === null) throw new TypeError('Unknown permission');
				const status = new EventTarget();
				Object.defineProperty(status, 'state', { get: () => s.permission });
				return status;
			}
		});
	}, stub);
}

async function setPersistence(page: Page, change: Partial<PersistenceStub>): Promise<void> {
	await page.evaluate((c) => {
		Object.assign((window as unknown as { persistence: object }).persistence, c);
	}, change);
}

test.describe('data protection', () => {
	test('explains that Chromium decides by itself and offers to install', async ({ page }) => {
		await onboard(page);
		await openSettings(page);
		const row = page.getByTestId('storage-protection');
		await expect(row.getByText('Off', { exact: true })).toBeVisible();
		await expect(row).toContainText('decides by itself');
		await expect(page.getByText('Back up regularly')).toBeVisible();

		await page.getByRole('button', { name: 'Install app' }).click();
		await expect(page.getByRole('heading', { name: 'Install Moneta' })).toBeVisible();
	});

	test('asks quietly on start where the browser decides by itself', async ({ page }) => {
		await stubPersistence(page, { persisted: false, permission: 'prompt', grants: true });
		await onboard(page);
		// The reload starts the stub over, unprotected: only the app's own request can protect it.
		await page.reload();
		await openSettings(page);
		const row = page.getByTestId('storage-protection');
		await expect(row.getByText('On', { exact: true })).toBeVisible();
	});

	test('checks again when the tab comes back', async ({ page }) => {
		await stubPersistence(page, { persisted: false, permission: null, grants: false });
		await onboard(page);
		await openSettings(page);
		const row = page.getByTestId('storage-protection');
		await expect(row.getByText('Off', { exact: true })).toBeVisible();

		const comeBack = () =>
			page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await setPersistence(page, { persisted: true });
		await comeBack();
		await expect(row.getByText('On', { exact: true })).toBeVisible();
		await expect(page.getByText('Back up regularly')).toHaveCount(0);

		await setPersistence(page, { persisted: false });
		await comeBack();
		await expect(row.getByText('Off', { exact: true })).toBeVisible();
	});

	test.describe('in Firefox', () => {
		test.use({
			userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'
		});

		test('explains how to undo a refusal', async ({ page }) => {
			await stubPersistence(page, { persisted: false, permission: 'denied', grants: false });
			await onboard(page);
			await openSettings(page);
			await expect(page.getByTestId('storage-protection')).toContainText('You declined');
			await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
		});

		test('asks the browser to protect the data', async ({ page }) => {
			await stubPersistence(page, { persisted: false, permission: 'prompt', grants: false });
			await onboard(page);
			await openSettings(page);
			const row = page.getByTestId('storage-protection');
			await expect(row.getByText('Off', { exact: true })).toBeVisible();

			await setPersistence(page, { grants: true });
			await page.getByRole('button', { name: 'Protect' }).click();
			await expect(row.getByText('On', { exact: true })).toBeVisible();
		});
	});
});

test('deletes everything on this device, back to a fresh start', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await page.getByRole('button', { name: 'Delete all data on this device' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Delete everything' }).click();
	await expect(dialog.getByRole('button', { name: /^Delete in \ds$/ })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Tap again to delete' }).click({ timeout: 10_000 });
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	// Only what the fresh start wrote is left: an empty list of budgets.
	const registry = await page.evaluate(() => localStorage.getItem('moneta.registry'));
	expect(JSON.parse(registry ?? '{}').budgets ?? []).toEqual([]);
});
