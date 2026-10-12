import { expect, test, type Page } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard, pickDate, spend } from './helpers';

async function addAccount(page: Page, name: string, balance: string, type = 'Savings') {
	await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: type }).click();
	await dialog.getByLabel('Account name').fill(name);
	await dialog.getByLabel('Current balance').fill(balance);
	await dialog.getByRole('button', { name: 'Add account', exact: true }).click();
	await expect(dialog).toBeHidden();
}

for (const phone of [false, true]) {
	test.describe(phone ? 'phone account context' : 'desktop account context', () => {
		test.use({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 } });

		test('identifies duplicate accounts and follows transfer direction in transactions and schedules', async ({
			page
		}) => {
			await onboard(page);
			await addAccount(page, 'Reserve', '200');
			await addAccount(page, 'Reserve', '-50');
			await addAccount(page, 'Investments', '0', 'Investment');
			await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
			const dialog = page.getByRole('dialog').first();
			await dialog.getByLabel('Account', { exact: true }).click();
			const picker = page.locator('[data-picker][data-state="open"]');
			const rows = picker.getByTestId('account-option');
			await expect(rows.filter({ hasText: 'Reserve (Savings 1)' })).toContainText('$200.00');
			await expect(rows.filter({ hasText: 'Reserve (Savings 2)' })).toContainText('-$50.00');
			await expect(rows.filter({ hasText: 'Investments' })).toContainText('Tracking');
			await expect(rows.filter({ hasText: 'Checking' })).toContainText('Current balance');
			if (phone) await expect(picker.locator('input')).not.toBeFocused();
			await picker.locator('input').fill('Checking');
			await picker.locator('input').press('Enter');
			await expect(picker).toBeHidden();
			await chooseCombobox(dialog, 'Payee', 'Transfer: Investments', 'Investments');
			await expect(dialog.getByTestId('transfer-budget-hint')).toContainText('leaves the budget');
			await dialog.getByRole('button', { name: 'Inflow', exact: true }).click();
			await expect(dialog.getByTestId('transfer-budget-hint')).toContainText('enters the budget');
			await chooseCombobox(dialog, 'Payee', 'Transfer: Reserve (Savings 2)', 'Reserve');
			await expect(dialog.getByTestId('transfer-budget-hint')).toContainText(
				'No category is needed'
			);
			await expect(dialog.getByLabel('Category', { exact: true })).toHaveCount(0);
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();

			await page
				.getByRole('link', { name: phone ? 'Transactions' : 'Schedules', exact: true })
				.first()
				.click();
			if (phone) await page.getByRole('link', { name: 'Scheduled', exact: true }).click();
			await page.getByRole('button', { name: 'Add schedule', exact: true }).first().click();
			await dialog.getByLabel('Account', { exact: true }).click();
			await expect(
				picker.getByTestId('account-option').filter({ hasText: 'Reserve (Savings 2)' })
			).toContainText('-$50.00');
			await picker.getByRole('option').filter({ hasText: 'Checking' }).click();
			await chooseCombobox(dialog, 'Payee', 'Transfer: Investments', 'Investments');
			await expect(dialog.getByTestId('transfer-budget-hint')).toContainText('leaves the budget');
		});

		test('keeps long names and custom icons usable, and Back preserves the draft', async ({
			page
		}) => {
			await onboard(page);
			await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
			await page.getByRole('button', { name: 'Settings for Checking' }).click();
			const dialog = page.getByRole('dialog').first();
			const name = 'A checking account with a long name to distinguish its household purpose';
			await dialog.getByLabel('Account name').fill(name);
			await dialog.getByLabel('Icon', { exact: true }).click();
			const picker = page.locator('[data-picker][data-state="open"]');
			await picker.getByRole('searchbox', { name: 'Search emoji' }).fill('money bag');
			await picker.getByRole('button', { name: 'money bag', exact: true }).click();
			await dialog.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(dialog).toBeHidden();
			await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
			await dialog.getByLabel('Amount', { exact: true }).fill('23');
			await dialog.getByLabel('Account', { exact: true }).click();
			const row = picker.getByTestId('account-option');
			await expect(row).toContainText('💰');
			await expect(row.getByTitle(name)).toBeVisible();
			await expect(row).toContainText('$1,000.00');
			await picker.locator('input').fill('Checking');
			await expect(row).toBeVisible();
			expect(await picker.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
			if (phone) await page.goBack();
			else await page.keyboard.press('Escape');
			await expect(picker).toBeHidden();
			await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('23');
		});

		test('shows destination available in the viewed month when deleting a category', async ({
			page
		}) => {
			await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
			await onboard(page);
			for (const [name, amount] of [
				['Groceries', '100'],
				['Dining Out', '75']
			]) {
				await categoryRow(page, name).getByRole('button', { name, exact: true }).click();
				const sheet = page.getByRole('dialog');
				await sheet.getByLabel('Assigned this month').fill(amount);
				await sheet.getByRole('button', { name: 'Save', exact: true }).click();
				await expect(sheet).toBeHidden();
			}
			await expect(categoryRow(page, 'Dining Out').getByTestId('available')).toHaveText('$75.00');
			await page.getByRole('link', { name: 'Previous month', exact: true }).click();
			await categoryRow(page, 'Dining Out')
				.getByRole('button', { name: 'Dining Out', exact: true })
				.click();
			const previousMonthSheet = page.getByRole('dialog');
			await previousMonthSheet.getByLabel('Assigned this month').fill('25');
			await previousMonthSheet.getByRole('button', { name: 'Save', exact: true }).click();
			await expect(previousMonthSheet).toBeHidden();
			await categoryRow(page, 'Groceries')
				.getByRole('button', { name: 'Groceries', exact: true })
				.click();
			const dialog = page.getByRole('dialog').first();
			await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
			await dialog.getByLabel('Move everything to').click();
			const picker = page.locator('[data-picker][data-state="open"]');
			const target = picker.getByRole('option').filter({ hasText: 'Dining Out' });
			await expect(target.getByTestId('available')).toHaveText('$25.00');
			await target.click();
			await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
			await expect(dialog).toBeHidden();
			await expect(categoryRow(page, 'Dining Out').getByTestId('available')).toHaveText('$25.00');
			await page.getByRole('link', { name: 'Next month', exact: true }).click();
			await expect(categoryRow(page, 'Dining Out').getByTestId('available')).toHaveText('$200.00');
		});
	});
}

test('future dates keep current account balances while closing moves the total', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
	await onboard(page);
	await addAccount(page, 'Savings', '200');
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Savings' })
		.getByRole('link')
		.click();
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Future expense', 'Future expense');
	await dialog.getByLabel('Amount', { exact: true }).fill('50');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await pickDate(dialog, 'Date', '2027-01-01');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await pickDate(dialog, 'Date', '2027-02-01');
	await dialog.getByLabel('Account', { exact: true }).click();
	const picker = page.locator('[data-picker][data-state="open"]');
	await expect(picker.getByTestId('account-option').filter({ hasText: 'Savings' })).toContainText(
		'$200.00'
	);
	await picker.getByRole('option').filter({ hasText: 'Savings' }).click();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await page.getByRole('link', { name: 'Accounts', exact: true }).first().click();
	await page.getByRole('button', { name: 'Settings for Savings' }).click();
	await dialog.getByRole('button', { name: 'Close account', exact: true }).click();
	await expect(dialog).toContainText('$150.00 moves to the account you pick');
	await expect(dialog).toContainText('includes future-dated transactions');
	await dialog.getByLabel('Transfer the balance to').click();
	await expect(picker.getByTestId('account-option').filter({ hasText: 'Checking' })).toContainText(
		'$1,000.00'
	);
});

test('refreshes balances after automatic entry without discarding an open draft', async ({
	page
}) => {
	await page.clock.install({ time: new Date('2026-10-11T12:00:00') });
	await onboard(page);
	await page.goto('/transactions/scheduled');
	await page.getByRole('button', { name: 'Add schedule', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Tomorrow expense', 'Tomorrow expense');
	await dialog.getByLabel('Amount', { exact: true }).fill('50');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await pickDate(dialog, 'Date', '2026-10-12');
	await dialog.getByLabel('Enter automatically').click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await dialog.getByLabel('Amount', { exact: true }).fill('23');
	await dialog.getByLabel('Account', { exact: true }).click();
	const picker = page.locator('[data-picker][data-state="open"]');
	const account = picker.getByTestId('account-option').filter({ hasText: 'Checking' });
	await expect(account).toContainText('$1,000.00');
	await page.clock.fastForward(24 * 60 * 60 * 1000);
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await expect(account).toContainText('$950.00');
	await picker.getByRole('option').filter({ hasText: 'Checking' }).click();
	await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('23');
});

test('deletion destinations show overspending and omit amounts for new and income categories', async ({
	page
}) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByTestId('assigned').fill('100');
	await categoryRow(page, 'Groceries').getByTestId('assigned').press('Enter');
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
	await spend(page, 'Dinner', '50', 'Dining Out');
	await categoryRow(page, 'Groceries')
		.getByRole('button', { name: 'Groceries', exact: true })
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
	await dialog.getByLabel('Move everything to').click();
	const picker = page.locator('[data-picker][data-state="open"]');
	const destination = picker.getByRole('option').filter({ hasText: 'Dining Out' });
	await expect(destination.getByTestId('available')).toHaveText('-$50.00');
	await expect(destination.getByTestId('available')).toHaveAttribute('data-tone', 'overspent');
	await picker.locator('input').fill('Replacement');
	const create = picker.getByRole('option').filter({ hasText: 'Create category' });
	await expect(create.getByTestId('available')).toHaveCount(0);
	await create.click();
	await picker.getByRole('option', { name: 'Everyday', exact: true }).click();
	await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(categoryRow(page, 'Replacement').getByTestId('available')).toHaveText('$100.00');
	await categoryRow(page, 'Starting Balance')
		.getByRole('button', { name: 'Starting Balance', exact: true })
		.click();
	await dialog.getByRole('button', { name: 'Delete category', exact: true }).click();
	await dialog.getByLabel('Move everything to').click();
	await expect(picker.getByRole('option').filter({ hasText: 'Salary' })).toBeVisible();
	await expect(picker.getByTestId('available')).toHaveCount(0);
});
