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

test('flags transactions, names a flag, and filters the register and the reports by flag', async ({
	page
}) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const form = page.getByRole('dialog');
	await chooseCombobox(form, 'Payee', 'Market', 'Market');
	await form.getByLabel('Amount', { exact: true }).fill('10');
	await chooseCombobox(form, 'Category', 'Groceries', 'Groceries');
	await chooseCombobox(form, 'Flag', 'Red');
	await form.getByRole('button', { name: 'Save' }).click();
	await expect(form).toBeHidden();
	await spend(page, 'Bakery', '20', 'Groceries');

	await openChecking(page);
	const rows = page.getByTestId('register-row');
	await expect(rows.filter({ hasText: 'Market' }).getByRole('img', { name: 'Red' })).toBeVisible();

	// The picker on an opened transaction renames the flags, then flags it at once.
	await rows.filter({ hasText: 'Bakery' }).getByRole('button', { name: 'Bakery' }).click();
	const overview = page.getByRole('dialog');
	await overview.getByRole('combobox', { name: 'Flag' }).click();
	const picker = page.locator('[data-picker][data-state="open"]');
	await picker.getByText('Edit flag names').click();
	await picker.getByLabel('Name of the Red flag').fill('Reimbursable');
	await picker.getByRole('button', { name: 'Save' }).click();
	await expect(picker.getByText('Reimbursable')).toBeVisible();
	await picker.getByText('Purple').click();
	await expect(picker).toBeHidden();
	await expect(overview.getByRole('combobox', { name: 'Flag' })).toContainText('Purple');
	await page.keyboard.press('Escape');
	await expect(overview).toBeHidden();
	await expect(
		rows.filter({ hasText: 'Market' }).getByRole('img', { name: 'Reimbursable' })
	).toBeVisible();
	await expect(
		rows.filter({ hasText: 'Bakery' }).getByRole('img', { name: 'Purple' })
	).toBeVisible();

	// The register's filters keep only the flags picked.
	await page.getByRole('button', { name: /Filters/ }).click();
	const filters = page.getByRole('dialog');
	await filters
		.getByRole('group', { name: 'Flags' })
		.getByRole('button', { name: 'Reimbursable' })
		.click();
	await filters.getByRole('button', { name: 'Apply' }).click();
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Market');

	// So do the reports.
	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Spending by category' }).click();
	await expect(page.getByTestId('spending-table')).toContainText('$30.00');
	await page.getByTestId('report-flag-filter').click();
	const flags = page.getByRole('dialog');
	await flags.getByRole('button', { name: 'Purple' }).click();
	await flags.getByRole('button', { name: 'Apply' }).click();
	await expect(page.getByTestId('spending-table')).toContainText('$20.00');
	await expect(page.getByTestId('spending-table')).not.toContainText('$30.00');
	await expect(page.getByTestId('report-flag-filter')).toContainText('Purple');
});

test('flags several transactions at once', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '10', 'Groceries');
	await spend(page, 'Bakery', '20', 'Groceries');
	await openChecking(page);
	const rows = page.getByTestId('register-row');

	await page.getByRole('button', { name: 'Select', exact: true }).click();
	await rows.filter({ hasText: 'Market' }).click();
	await rows.filter({ hasText: 'Bakery' }).click();
	const bar = page.getByTestId('selection-bar');
	await bar.getByRole('button', { name: 'Flag' }).click();
	await page.getByRole('dialog').getByText('Blue').click();
	await expect(page.getByRole('region', { name: /Notifications/ })).toContainText(
		'Transactions changed: 2.'
	);
	await expect(rows.getByRole('img', { name: 'Blue' })).toHaveCount(2);
});
