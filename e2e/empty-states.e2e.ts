import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, nextStep, skipIntro, startApp, skipTour } from './helpers';

/** Creates a USD budget with the starter categories and no account. */
async function onboardWithoutAccount(page: Page): Promise<void> {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();
	await nextStep(page).click();
	await page.getByRole('button', { name: 'Start with no account' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await skipTour(page);
	await expect(page.getByTestId('rta-amount')).toHaveText('$0.00');
}

/** Adds a checking account named `name` from the "No open accounts" screen. */
async function addAccountFromEmptyState(page: Page, name: string): Promise<void> {
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await dialog.getByRole('button', { name: 'Checking' }).click();
	await dialog.getByLabel('Account name').fill(name);
	await dialog.getByLabel('Current balance').fill('100');
	await dialog.getByRole('button', { name: 'Add account' }).click();
}

test('adds an account from the transaction dialog and goes on with the transaction', async ({
	page
}) => {
	await onboardWithoutAccount(page);
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('No open accounts')).toBeVisible();

	// Back from the account form returns to the empty state.
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog.getByRole('button', { name: 'Checking' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Back' }).click();
	await expect(dialog.getByText('No open accounts')).toBeVisible();

	await addAccountFromEmptyState(page, 'Wallet');
	await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveText(/Wallet/);
	await chooseCombobox(dialog, 'Payee', 'Bakery', 'Bakery');
	await dialog.getByLabel('Amount', { exact: true }).fill('12');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Transactions' }).first().click();
	const rows = page.getByTestId('register-row');
	await expect(rows.filter({ hasText: 'Bakery' })).toContainText('Wallet');
});

test('adds an account from the schedule dialog', async ({ page }) => {
	await onboardWithoutAccount(page);
	await page.getByRole('link', { name: 'Schedules' }).first().click();
	await page.getByRole('button', { name: 'Add schedule' }).first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('No open accounts')).toBeVisible();

	await addAccountFromEmptyState(page, 'Wallet');
	await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveText(/Wallet/);
	await expect(dialog.getByRole('heading', { name: 'New schedule' })).toBeVisible();
});

test('says so when every account is closed', async ({ page }) => {
	await onboardWithoutAccount(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).first().click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByLabel('Account name').fill('Old savings');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('main').getByRole('button', { name: 'Settings for Old savings' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	await expect(dialog.getByText('No open accounts')).toBeVisible();
	await expect(dialog.getByText('reopen one in Accounts')).toBeVisible();
});

/** Creates a USD budget with no categories and no account. */
async function onboardEmpty(page: Page): Promise<void> {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();
	await page.getByRole('button', { name: 'Start with no categories' }).click();
	await nextStep(page).click();
	await page.getByRole('button', { name: 'Start with no account' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await skipTour(page);
	await expect(page.getByTestId('rta-amount')).toHaveText('$0.00');
}

test('each empty screen offers its next step', async ({ page }) => {
	await onboardEmpty(page);
	const empty = page.getByTestId('empty-state');
	const dialog = page.getByRole('dialog');

	await expect(empty).toContainText('No categories yet');
	await empty.getByRole('button', { name: 'Add group' }).click();
	await expect(dialog.getByRole('heading', { name: 'Add group' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(empty).toContainText('No accounts yet');
	await empty.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog.getByRole('heading', { name: 'Add account' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Schedules' }).first().click();
	await expect(empty).toContainText('No schedules yet');
	await empty.getByRole('button', { name: 'Add schedule' }).click();
	await expect(dialog.getByRole('heading', { name: 'New schedule' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Transactions' }).first().click();
	await expect(empty).toContainText('No transactions yet');
	await empty.getByRole('button', { name: 'Add transaction' }).click();
	await expect(dialog.getByRole('heading', { name: 'New transaction' })).toBeVisible();
	await addAccountFromEmptyState(page, 'Wallet');
	await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveText(/Wallet/);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	// The account's starting balance is a transaction; a search that misses it can be cleared.
	const rows = page.getByTestId('register-row');
	await expect(rows).toHaveCount(1);
	await page.getByRole('searchbox').fill('nothing like this');
	await expect(empty).toContainText('Nothing matches this search or these filters.');
	await empty.getByRole('button', { name: 'Clear filters' }).click();
	await expect(rows).toHaveCount(1);
	await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('a payee search with no match can be cleared', async ({ page }) => {
	await onboardWithoutAccount(page);
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	await addAccountFromEmptyState(page, 'Wallet');
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Bakery', 'Bakery');
	await dialog.getByLabel('Amount', { exact: true }).fill('12');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Payees' }).first().click();
	await page.getByRole('searchbox').fill('nothing like this');
	const empty = page.getByTestId('empty-state');
	await expect(empty).toContainText('No payees match “nothing like this”.');
	await empty.getByRole('button', { name: 'Clear search' }).click();
	await expect(page.getByRole('searchbox')).toHaveValue('');
	await expect(page.getByText('Bakery')).toBeVisible();
});
