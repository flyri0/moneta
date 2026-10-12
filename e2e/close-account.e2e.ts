import { expect, test, type Page } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard, pickDate } from './helpers';

async function addAccount(page: Page, name = 'Savings', balance = '200', type = 'Savings') {
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: type }).click();
	await dialog.getByLabel('Account name').fill(name);
	await dialog.getByLabel('Current balance').fill(balance);
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();
}

async function closeScreen(page: Page, name = 'Savings') {
	await page.getByRole('button', { name: `Settings for ${name}` }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Close account', exact: true }).click();
	return dialog;
}

function accountRow(page: Page, name: string) {
	return page.getByRole('main').getByTestId('account-row').filter({ hasText: name });
}

test('closing an account with money transfers it first and Undo restores both balances', async ({
	page
}) => {
	await onboard(page);
	await addAccount(page);
	const dialog = await closeScreen(page);
	await expect(dialog).toContainText('$200.00 moves to the account you pick');
	await dialog.getByRole('button', { name: 'Transfer and close' }).click();
	await expect(dialog).toContainText('Choose an account');
	await chooseCombobox(dialog, 'Transfer the balance to', 'Checking', 'Checking');
	await expect(dialog.getByTestId('form-message')).toBeHidden();
	await expect(dialog.getByLabel('Category', { exact: true })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Transfer and close' }).click();
	await expect(dialog).toBeHidden();
	await expect(accountRow(page, 'Checking')).toContainText('$1,200.00');
	await expect(page.getByRole('main').getByRole('region', { name: 'Closed' })).toContainText(
		'Savings'
	);
	await page
		.getByRole('region', { name: /Notifications/ })
		.getByRole('button', { name: 'Undo', exact: true })
		.last()
		.click();
	await expect(accountRow(page, 'Checking')).toContainText('$1,000.00');
	await expect(accountRow(page, 'Savings')).toContainText('$200.00');
	await page.getByRole('button', { name: 'Settings for Savings' }).click();
	await expect(dialog.getByRole('button', { name: 'Close account', exact: true })).toBeVisible();
});

test('deleting a nonempty account waits for a second click, resets on cancel, and supports Undo', async ({
	page
}) => {
	await onboard(page);
	await addAccount(page);
	const dialog = await closeScreen(page);
	await dialog.getByRole('button', { name: 'Delete account and its transactions' }).click();
	await expect(dialog).toContainText('Transactions in this account: 1');
	await dialog.getByRole('button', { name: 'Delete everything' }).click();
	await expect(dialog.getByRole('button', { name: /Delete in \d+s/ })).toBeDisabled();
	await expect(accountRow(page, 'Savings')).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await dialog.getByRole('button', { name: 'Close account', exact: true }).click();
	await dialog.getByRole('button', { name: 'Delete account and its transactions' }).click();
	await expect(dialog.getByRole('button', { name: 'Delete everything' })).toBeEnabled();
	await dialog.getByRole('button', { name: 'Delete everything' }).click();
	await dialog
		.getByRole('button', { name: /(Tap|Click) again to delete/ })
		.click({ timeout: 10_000 });
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/accounts$/);
	await expect(accountRow(page, 'Savings')).toHaveCount(0);
	await page
		.getByRole('region', { name: /Notifications/ })
		.getByRole('button', { name: 'Undo', exact: true })
		.last()
		.click();
	await expect(accountRow(page, 'Savings')).toContainText('$200.00');
	await accountRow(page, 'Savings').getByRole('link').click();
	await expect(page.getByTestId('register-row')).toHaveCount(1);
});

test('zero balance closes without a transfer and a closed empty account deletes without a wait', async ({
	page
}) => {
	await onboard(page);
	await addAccount(page, 'Empty', '0');
	const dialog = await closeScreen(page, 'Empty');
	await expect(dialog).toContainText('The account keeps its history');
	await expect(dialog.getByLabel('Transfer the balance to')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close account', exact: true }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('button', { name: 'Settings for Empty' }).click();
	await expect(dialog.getByRole('button', { name: 'Reopen account' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Delete account and its transactions' }).click();
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(accountRow(page, 'Empty')).toHaveCount(0);
	await page
		.getByRole('region', { name: /Notifications/ })
		.getByRole('button', { name: 'Undo', exact: true })
		.last()
		.click();
	await expect(accountRow(page, 'Empty')).toBeVisible();
});

test('zero balance closure offers Undo that reopens the account without creating transactions', async ({
	page
}) => {
	await onboard(page);
	await addAccount(page, 'Empty', '0');
	const dialog = await closeScreen(page, 'Empty');
	await dialog.getByRole('button', { name: 'Close account', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('main').getByRole('region', { name: 'Closed' })).toContainText(
		'Empty'
	);
	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Account closed.');
	await expect(toast.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
	await toast.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(
		page.getByRole('main').getByRole('region', { name: 'On budget', exact: true })
	).toContainText('Empty');
	await expect(accountRow(page, 'Empty')).toContainText('$0.00');
	await expect(accountRow(page, 'Checking')).toContainText('$1,000.00');
	await page.getByRole('button', { name: 'Settings for Empty' }).click();
	await expect(dialog.getByRole('button', { name: 'Close account', exact: true })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Reopen account' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await accountRow(page, 'Empty').getByRole('link').click();
	await expect(page.getByTestId('register-row')).toHaveCount(0);
});

test('closing includes future dated transactions in the transferred balance', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
	await onboard(page);
	await addAccount(page);
	await accountRow(page, 'Savings').getByRole('link').click();
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	let dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Future purchase', 'Future purchase');
	await dialog.getByLabel('Amount', { exact: true }).fill('50');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await pickDate(dialog, 'Date', '2027-01-01');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	dialog = await closeScreen(page);
	await expect(dialog).toContainText('$150.00 moves to the account you pick');
	await chooseCombobox(dialog, 'Transfer the balance to', 'Checking', 'Checking');
	await dialog.getByRole('button', { name: 'Transfer and close' }).click();
	await expect(dialog).toBeHidden();
	await expect(accountRow(page, 'Checking')).toContainText('$1,150.00');
	await page.getByRole('button', { name: 'Settings for Savings' }).click();
	await expect(dialog.getByRole('button', { name: 'Reopen account' })).toBeVisible();
});

test('a transfer out of the budget requires a category and creates it in spending groups', async ({
	page
}) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const categorySettings = page.getByRole('dialog');
	await categorySettings.getByRole('button', { name: 'Category settings' }).click();
	await categorySettings.getByLabel('Hidden').click();
	await expect(categorySettings.getByLabel('Hidden')).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(categorySettings).toBeHidden();
	await addAccount(page, 'Investments', '0', 'Investment');
	await addAccount(page);
	const dialog = await closeScreen(page);
	await chooseCombobox(dialog, 'Transfer the balance to', 'Investments', 'Investments');
	await dialog.getByRole('button', { name: 'Transfer and close' }).click();
	await expect(dialog).toContainText('Choose a category');
	await dialog.getByLabel('Category', { exact: true }).click();
	const picker = page.locator('[data-picker][data-state="open"]');
	const items = picker.locator('[data-slot="command-item"]');
	await expect(items.first()).toContainText('Rent');
	await expect(picker.getByRole('option', { name: /Groceries/ })).toHaveCount(0);
	await picker.locator('[data-slot="command-input"]').fill('Closing reserve');
	await items.filter({ hasText: 'Create' }).click();
	await expect(picker.getByRole('option', { name: 'Income', exact: true })).toHaveCount(0);
	await picker.getByRole('option', { name: 'Everyday', exact: true }).click();
	await expect(picker).toBeHidden();
	await dialog.getByRole('button', { name: 'Transfer and close' }).click();
	await expect(dialog).toBeHidden();
	await expect(accountRow(page, 'Investments')).toContainText('$200.00');
	await accountRow(page, 'Savings').getByRole('link').click();
	await expect(page.getByTestId('register-row').filter({ hasText: 'Investments' })).toContainText(
		'Closing reserve'
	);
});

test('a negative balance closes with an inflow and permits creating an income category', async ({
	page
}) => {
	await onboard(page);
	await addAccount(page, 'Investments', '0', 'Investment');
	await addAccount(page, 'Savings', '-200');
	const dialog = await closeScreen(page);
	await expect(dialog).toContainText('$200.00 comes from the account you pick');
	await chooseCombobox(dialog, 'Transfer the balance from', 'Investments', 'Investments');
	await expect(dialog.getByTestId('transfer-budget-hint')).toContainText('enters the budget');
	await dialog.getByLabel('Category', { exact: true }).click();
	const picker = page.locator('[data-picker][data-state="open"]');
	const items = picker.locator('[data-slot="command-item"]');
	await expect(items.first()).toContainText('Salary');
	await picker.locator('[data-slot="command-input"]').fill('Closing proceeds');
	await items.filter({ hasText: 'Create' }).click();
	await picker.getByRole('option', { name: 'Income', exact: true }).click();
	await expect(picker).toBeHidden();
	await dialog.getByRole('button', { name: 'Transfer and close' }).click();
	await expect(dialog).toBeHidden();
	await expect(accountRow(page, 'Investments')).toContainText('-$200.00');
	await accountRow(page, 'Savings').getByRole('link').click();
	await expect(page.getByTestId('register-row').filter({ hasText: 'Investments' })).toContainText(
		'Closing proceeds'
	);
});

test('deleting from a closed register lists transfers and schedules, then Undo restores them', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
	await onboard(page);
	await addAccount(page);
	await page.getByRole('link', { name: 'Schedules', exact: true }).first().click();
	await page.getByRole('button', { name: 'Add schedule' }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Transfer: Savings', 'Savings');
	await dialog.getByLabel('Amount', { exact: true }).fill('5');
	await pickDate(dialog, 'Date', '2027-01-01');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('schedule-row')).toHaveCount(1);
	await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
	await accountRow(page, 'Savings').getByRole('link').click();
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await chooseCombobox(dialog, 'Payee', 'Transfer: Checking', 'Checking');
	await dialog.getByLabel('Amount', { exact: true }).fill('200');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
	await accountRow(page, 'Checking').getByRole('link').click();
	const cleared = page
		.getByTestId('register-row')
		.filter({ hasText: 'Savings' })
		.getByRole('button', { name: 'Cleared' });
	await cleared.click();
	await expect(cleared).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Reconcile', exact: true }).click();
	await dialog.getByRole('button', { name: 'Yes, reconcile' }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
	await closeScreen(page);
	await dialog.getByRole('button', { name: 'Close account', exact: true }).click();
	await expect(dialog).toBeHidden();
	await accountRow(page, 'Savings').getByRole('link').click();
	await page.getByRole('button', { name: 'Settings for Savings' }).click();
	await dialog.getByRole('button', { name: 'Delete account and its transactions' }).click();
	await expect(dialog).toContainText('Transactions in this account: 2');
	await expect(dialog).toContainText('Schedules: 1');
	await expect(dialog).toContainText(
		'Transfers with Checking: 1. Its balance changes by -$200.00.'
	);
	await expect(dialog).toContainText('Reconciled there: 1.');
	await dialog.getByRole('button', { name: 'Delete everything' }).click();
	await dialog
		.getByRole('button', { name: /(Tap|Click) again to delete/ })
		.click({ timeout: 10_000 });
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/accounts$/);
	await expect(accountRow(page, 'Savings')).toHaveCount(0);
	await expect(accountRow(page, 'Checking')).toContainText('$1,000.00');
	await page
		.getByRole('region', { name: /Notifications/ })
		.getByRole('button', { name: 'Undo', exact: true })
		.last()
		.click();
	await expect(accountRow(page, 'Savings')).toBeVisible();
	await expect(accountRow(page, 'Checking')).toContainText('$1,200.00');
	await page.getByRole('link', { name: 'Schedules', exact: true }).first().click();
	await expect(page.getByTestId('schedule-row')).toHaveCount(1);
});
