import { expect, test } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard, pickDate, pickDateRange, spend } from './helpers';

test('lists the transactions of every account', async ({ page }) => {
	await onboard(page);
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await expect(sidebar.getByRole('link')).toHaveText([
		'Budget',
		'Transactions',
		'Accounts',
		'Reports',
		'Payees',
		'Schedules',
		'Settings'
	]);

	await sidebar.getByRole('link', { name: 'Accounts' }).click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByLabel('Account name').fill('Rainy day');
	await dialog.getByLabel('Current balance').fill('250');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	const rows = page.getByTestId('register-row');
	await expect(rows).toHaveCount(2);
	await expect(rows.filter({ hasText: 'Checking' })).toContainText('$1,000.00');
	await expect(rows.filter({ hasText: 'Rainy day' })).toContainText('$250.00');

	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('Nothing matches this search or these filters.')).toBeVisible();
	// The account's own name, any case, and amounts match too.
	await page.getByRole('searchbox').fill('RAINY');
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Rainy day');
	await page.getByRole('searchbox').fill('1,000');
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Checking');
	await page.getByRole('searchbox').fill('');
	await expect(rows).toHaveCount(2);

	await rows
		.filter({ hasText: 'Rainy day' })
		.getByRole('button', { name: 'Starting balance' })
		.click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	// A tap anywhere on the row opens it too, not only on the payee.
	await rows.filter({ hasText: 'Rainy day' }).getByTestId('register-amount').click();
	await expect(dialog).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps the bar to five destinations, with Payees and Scheduled inside Transactions', async ({
		page
	}) => {
		await onboard(page);
		const bar = page.getByRole('navigation', { name: 'Main' });
		await expect(bar.locator('[data-nav-label]')).toHaveText([
			'Budget',
			'Transactions',
			'Accounts',
			'Reports',
			'Settings'
		]);

		await bar.getByRole('link', { name: 'Transactions' }).click();
		await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
		await page.getByRole('link', { name: 'Scheduled' }).click();
		await expect(page.getByRole('button', { name: 'Add schedule' }).first()).toBeVisible();
		await expect(bar.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await page.getByRole('link', { name: 'All' }).click();
		await page.getByRole('link', { name: 'Payees' }).click();
		await expect(page.getByRole('heading', { name: 'Payees' })).toBeVisible();
		await expect(bar.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await bar.getByRole('link', { name: 'Settings' }).click();
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	});

	test('filters by period, amount and status from one dialog', async ({ page }) => {
		await onboard(page);
		await page.goto('/transactions');
		const rows = page.getByTestId('register-row');
		await expect(rows).toHaveCount(1);
		const dialog = page.getByRole('dialog');
		const filters = page.getByRole('button', { name: /^Filters/ });
		await expect(page.getByLabel('From')).toHaveCount(0);

		await filters.click();
		await expect(dialog.getByRole('button', { name: 'Period' })).toBeVisible();
		await dialog.getByLabel('Amount from').fill('999999');
		await dialog.getByRole('button', { name: 'Apply' }).click();
		await expect(dialog).toBeHidden();
		await expect(rows).toHaveCount(0);
		await expect(filters).toContainText('1');

		await filters.click();
		await dialog.getByLabel('Amount from').fill('abc');
		await dialog.getByRole('button', { name: 'Apply' }).click();
		await expect(dialog.getByRole('alert')).toBeVisible();
		await dialog.getByRole('button', { name: 'Clear filters' }).click();
		await expect(dialog).toBeHidden();
		await expect(rows).toHaveCount(1);
		await expect(filters).not.toContainText('1');
	});

	test('picks a period as one range', async ({ page }) => {
		await onboard(page);
		await page.goto('/transactions');
		const rows = page.getByTestId('register-row');
		const dialog = page.getByRole('dialog');
		await page.getByRole('button', { name: /^Filters/ }).click();
		await pickDateRange(dialog, 'Period', '2020-03-05', '2020-03-20');
		await dialog.getByRole('button', { name: 'Apply' }).click();
		await expect(dialog).toBeHidden();
		await expect(rows).toHaveCount(0);
		await expect(page.getByText('Nothing matches this search or these filters.')).toBeVisible();
		await page.getByRole('button', { name: 'Clear filters' }).click();
		await expect(rows).toHaveCount(1);
	});

	test('shrinks the add-transaction button to its icon on scroll', async ({ page }) => {
		await onboard(page);
		const add = page.getByRole('button', { name: 'Transaction', exact: true });
		const label = add.locator('[data-fab-label]');
		await expect(label).toBeVisible();

		await page.evaluate(() => window.scrollTo(0, 200));
		await expect(add).toHaveAttribute('data-compact', 'true');
		await expect(label).toBeHidden();

		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(label).toBeVisible();

		// A short page opened from a scrolled one starts at the top, with the label back.
		await page.evaluate(() => window.scrollTo(0, 200));
		await expect(label).toBeHidden();
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('link', { name: 'Transactions' })
			.click();
		await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
		await expect(label).toBeVisible();

		await add.click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});
});

test('asks before saving a transaction dated years ahead', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Market', 'Market');
	await dialog.getByLabel('Amount', { exact: true }).fill('12');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	const ahead = new Date();
	ahead.setFullYear(ahead.getFullYear() + 3);
	await pickDate(dialog, 'Date', ahead.toISOString().slice(0, 10));
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByTestId('far-future')).toBeVisible();
	await dialog.getByRole('button', { name: 'Save anyway' }).click();
	await expect(dialog).toBeHidden();
});

test('opens a transaction on its overview, with editing and its account a tap away', async ({
	page
}) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Bakery', 'Bakery');
	await dialog.getByLabel('Amount', { exact: true }).fill('12');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByLabel('Memo').fill('Bread');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await page.getByTestId('register-row').filter({ hasText: 'Bakery' }).click();
	const overview = dialog.getByTestId('transaction-overview');
	await expect(dialog.getByRole('heading', { name: 'Bakery' })).toBeVisible();
	await expect(dialog.getByTestId('transaction-overview-amount')).toHaveText('-$12.00');
	await expect(overview).toContainText('Checking');
	await expect(overview).toContainText('Groceries');
	await expect(overview).toContainText('Bread');

	// Cancel in the form goes back to the overview.
	await dialog.getByRole('button', { name: 'Edit transaction' }).click();
	await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue(/12/);
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(overview).toBeVisible();

	await dialog.getByRole('button', { name: 'Open Checking' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');

	// Its own account's page doesn't link to itself.
	await page.getByTestId('register-row').filter({ hasText: 'Bakery' }).click();
	await expect(overview).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Open Checking' })).toHaveCount(0);
});

test("gives a transfer's name the empty category column", async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByLabel('Account name').fill('Emergency savings');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	await chooseCombobox(dialog, 'Account', 'Checking', 'Checking');
	await chooseCombobox(dialog, 'Payee', 'Transfer: Emergency savings', 'Emergency');
	await dialog.getByLabel('Amount', { exact: true }).fill('100');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Transactions' }).first().click();
	for (const name of ['Transfer to Emergency savings', 'Transfer from Checking']) {
		const payee = page.getByTestId('register-row').getByRole('button', { name });
		await expect(payee).toBeVisible();
		// Not cut off with an ellipsis.
		expect(await payee.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
	}
});

/** The 15th of next month, as 'YYYY-MM-DD' in local time. */
function nextMonthDate(): string {
	const now = new Date();
	const d = new Date(now.getFullYear(), now.getMonth() + 1, 15);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

test("shows each category's Available for the transaction's month", async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('300');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(groceries.getByTestId('available')).toHaveText('$300.00');
	await spend(page, 'Market', '50', 'Groceries');
	await spend(page, 'Cafe', '30', 'Dining Out');

	const dialog = page.getByRole('dialog');
	const picker = page.locator('[data-picker][data-state="open"]');
	const item = (name: string) =>
		picker.locator('[data-slot="command-item"]').filter({ hasText: name });
	const pill = (name: string) => item(name).getByTestId('available');

	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	await dialog.getByLabel('Category', { exact: true }).click();
	await expect(pill('Groceries')).toHaveText('$250.00');
	await expect(pill('Dining Out')).toHaveAttribute('data-tone', 'overspent');
	await expect(item('Salary')).toBeVisible();
	await expect(pill('Salary')).toHaveCount(0);
	await item('Groceries').click();

	// Next month: Groceries carries over, Dining Out's overspending doesn't.
	await pickDate(dialog, 'Date', nextMonthDate());
	await dialog.getByLabel('Category', { exact: true }).click();
	await expect(pill('Dining Out')).toHaveText('$0.00');
	await expect(pill('Groceries')).toHaveText('$250.00');
	await item('Groceries').click();

	// Split lines show them too.
	await dialog.getByLabel('Amount', { exact: true }).fill('20');
	await dialog.getByRole('button', { name: 'Split' }).click();
	await dialog.getByLabel('Category for line 1').click();
	await expect(pill('Groceries')).toHaveText('$250.00');
	await item('Groceries').click();
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toBeHidden();

	// Editing a transaction: Available as it stands, which already counts it.
	await page.getByRole('link', { name: 'Transactions' }).first().click();
	await page.getByTestId('register-row').getByRole('button', { name: 'Market' }).click();
	await dialog.getByRole('button', { name: 'Edit transaction' }).click();
	await dialog.getByLabel('Category', { exact: true }).click();
	await expect(pill('Groceries')).toHaveText('$250.00');
	await item('Groceries').click();
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	// Schedules are about future dates: their picker shows none.
	await page.goto('/transactions/scheduled');
	await page.getByRole('button', { name: 'Add schedule' }).first().click();
	await dialog.getByLabel('Category', { exact: true }).click();
	await expect(item('Groceries')).toBeVisible();
	await expect(picker.getByTestId('available')).toHaveCount(0);
});
