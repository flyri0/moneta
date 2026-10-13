import { expect, test } from '@playwright/test';

import { categoryRow, onboard, openBackupPart, openSettings } from './helpers';

test.describe('mobile Back', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('unwinds flag names, picker and form, preserving the form and URL', async ({ page }) => {
		await onboard(page);
		const url = page.url();
		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		const form = page.getByRole('dialog', { name: 'New transaction' });
		await form.getByLabel('Amount', { exact: true }).fill('23');
		await form.getByRole('combobox', { name: 'Flag', exact: true }).click();
		const picker = page.locator('[data-picker][data-state="open"]');
		await picker.getByText('Edit flag names').click();
		await expect(picker.getByLabel('Name of the Red flag')).toBeVisible();
		await page.goBack();
		await expect(picker.getByText('Edit flag names')).toBeVisible();
		await page.goBack();
		await expect(picker).toBeHidden();
		await expect(form.getByLabel('Amount', { exact: true })).toHaveValue('23');
		await page.goBack();
		await expect(form).toBeHidden();
		expect(page.url()).toBe(url);
		await page.goForward();
		await expect(form).toBeHidden();
	});

	test('manual close and immediate navigation leave no extra Back step', async ({ page }) => {
		await onboard(page);
		const budget = page.url();
		await categoryRow(page, 'Groceries').click();
		const drawer = page.getByRole('dialog');
		await drawer.getByLabel('Assigned this month').fill('100');
		await drawer.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(drawer).toBeHidden();
		await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
		await expect(page).toHaveURL(/\/accounts$/);
		await page.goBack();
		await expect(page).toHaveURL(budget);
		await expect(drawer).toBeHidden();
	});

	test('a directly loaded page closes its drawer before navigating away', async ({ page }) => {
		await onboard(page);
		await page.goto('/accounts');
		await page.getByRole('button', { name: 'Add account' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.goBack();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page).toHaveURL(/\/accounts$/);
		await page.goBack();
		await expect(page).toHaveURL(/\/budget\//);
	});

	test('reload does not reopen layers or leave a phantom Back step', async ({ page }) => {
		await onboard(page);
		const budget = page.url();
		await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
		await page.getByRole('button', { name: 'Add account' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.reload();
		await expect(page.getByRole('button', { name: 'Add account' })).toBeVisible();
		await expect(page.getByRole('dialog')).toBeHidden();
		await page.goBack();
		await expect(page).toHaveURL(budget);
	});

	test('changing width removes and restores protection without closing the dialog', async ({
		page
	}) => {
		await onboard(page);
		const url = page.url();
		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		const form = page.getByRole('dialog', { name: 'New transaction' });
		await form.getByLabel('Amount', { exact: true }).fill('42');
		await page.setViewportSize({ width: 1024, height: 844 });
		await expect(form).toHaveAttribute('data-slot', 'dialog-content');
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(form).toHaveAttribute('data-slot', 'sheet-content');
		await page.goBack();
		await expect(form).toBeHidden();
		expect(page.url()).toBe(url);
	});

	test('Back closes a calendar before the transaction form', async ({ page }) => {
		await onboard(page);
		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		const form = page.getByRole('dialog', { name: 'New transaction' });
		await form.getByLabel('Amount', { exact: true }).fill('17');
		await form.getByLabel('Date', { exact: true }).click();
		const calendar = page.locator('[data-slot="popover-content"][data-state="open"]');
		await expect(calendar).toBeVisible();
		await page.goBack();
		await expect(calendar).toBeHidden();
		await expect(form.getByLabel('Amount', { exact: true })).toHaveValue('17');
	});

	test('Back closes a bulk dialog before ending selection', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
		await page
			.getByRole('main')
			.getByTestId('account-row')
			.filter({ hasText: 'Checking' })
			.getByRole('link')
			.click();
		await expect(page.getByTestId('register-title')).toHaveText('Checking');
		const url = page.url();
		await page.getByRole('button', { name: 'Select', exact: true }).click();
		const bar = page.getByTestId('selection-bar');
		await bar.getByRole('button', { name: 'Select all' }).click();
		await bar.getByRole('button', { name: 'Category' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await page.goBack();
		await expect(dialog).toBeHidden();
		await expect(bar).toBeVisible();
		await expect(page).toHaveURL(url);

		await page.goBack();
		await expect(bar).toBeHidden();
		await expect(page).toHaveURL(url);
	});

	test('manually closing a bulk dialog leaves one Back step for selection', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
		await page
			.getByRole('main')
			.getByTestId('account-row')
			.filter({ hasText: 'Checking' })
			.getByRole('link')
			.click();
		await expect(page.getByTestId('register-title')).toHaveText('Checking');
		const url = page.url();
		await page.getByRole('button', { name: 'Select', exact: true }).click();
		const bar = page.getByTestId('selection-bar');
		await bar.getByRole('button', { name: 'Select all' }).click();
		await bar.getByRole('button', { name: 'Category' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(dialog).toBeHidden();

		await page.goBack();
		await expect(bar).toBeHidden();
		await expect(page).toHaveURL(url);
		await page.goBack();
		await expect(page).toHaveURL(/\/accounts$/);
	});

	test('manual Cancel and Escape leave normal page history', async ({ page }) => {
		await onboard(page);
		const budget = page.url();
		await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(page.getByRole('dialog')).toBeHidden();
		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toBeHidden();
		await page.goBack();
		await expect(page).toHaveURL(budget);
	});

	test('Back closes the month picker without navigating', async ({ page }) => {
		await onboard(page);
		const budget = page.url();
		await page.getByRole('button', { name: 'Select month and year' }).click();
		const picker = page.locator('[data-slot="popover-content"][data-state="open"]');
		await expect(picker).toBeVisible();
		await page.goBack();
		await expect(picker).toBeHidden();
		expect(page.url()).toBe(budget);
	});

	test('Back returns from the recovery key to the password before closing encryption setup', async ({
		page
	}) => {
		await onboard(page);
		await openSettings(page);
		const url = page.url();
		const sheet = await openBackupPart(page, 'Encryption');
		await sheet.getByRole('switch', { name: 'Encrypt backups' }).click();
		const dialog = page.getByRole('dialog', { name: 'Encrypt backups', exact: true });
		await dialog.getByLabel('Password', { exact: true }).fill('correct horse');
		await dialog.getByLabel('Confirm password').fill('correct horse');
		await dialog.getByRole('button', { name: 'Next' }).click();
		await expect(page.getByTestId('recovery-key')).toBeVisible();
		await page.goBack();
		await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('correct horse');
		await page.goBack();
		await expect(dialog).toBeHidden();
		expect(page.url()).toBe(url);
	});

	test('Back returns to the account types before closing the account drawer', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
		await expect(page).toHaveURL(/\/accounts$/);
		const url = page.url();
		await page.getByRole('button', { name: 'Add account' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add account' });
		await dialog.getByRole('button', { name: /^Checking/ }).click();
		await dialog.getByLabel('Account name').fill('Savings');
		await page.goBack();
		await expect(dialog.getByRole('button', { name: /^Checking/ })).toBeVisible();
		await dialog.getByRole('button', { name: /^Checking/ }).click();
		await expect(dialog.getByLabel('Account name')).toHaveValue('Savings');
		await page.goBack();
		await expect(dialog.getByRole('button', { name: /^Checking/ })).toBeVisible();
		await page.goBack();
		await expect(dialog).toBeHidden();
		expect(page.url()).toBe(url);
	});

	test('consecutive Back gestures close one layer each', async ({ page }) => {
		await onboard(page);
		const url = page.url();
		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		await page.getByRole('dialog').getByRole('combobox', { name: 'Flag', exact: true }).click();
		await page.evaluate(async () => {
			const back = () =>
				new Promise<void>((resolve) => {
					window.addEventListener('popstate', () => resolve(), { once: true });
					history.back();
				});
			await back();
			await back();
		});
		await expect(page.locator('[role=dialog][data-state=open]')).toHaveCount(0);
		expect(page.url()).toBe(url);
	});
});

test('desktop dialogs do not create a history entry', async ({ page }) => {
	await onboard(page);
	const budget = page.url();
	await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	await page.goBack();
	await expect(page).toHaveURL(budget);
});
