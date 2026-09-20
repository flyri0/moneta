import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, chooseSelect, onboard, pickDate } from './helpers';

async function spend(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Payee').fill(payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await chooseCombobox(dialog, 'Category', category, category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('shows spending by category with its transactions, and net worth', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');
	await spend(page, 'Bistro', '40', 'Dining Out');
	await spend(page, 'Bakery', '15', 'Groceries');

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
	// One control scopes the whole page; two would be ambiguous to read and to drive.
	await expect(page.getByLabel('Period')).toHaveCount(1);

	const table = page.getByTestId('spending-table');
	await expect(table.locator('tbody tr')).toHaveText([
		/Groceries.*\$75\.00.*65\.2%/,
		/Dining Out.*\$40\.00.*34\.8%/
	]);
	await expect(table.locator('tfoot')).toContainText('$115.00');

	await table.getByRole('button', { name: /Groceries/ }).click();
	const drill = page.getByRole('region', { name: 'Transactions in Groceries' });
	await expect(drill.getByRole('listitem')).toHaveText([/Bakery.*-\$15\.00/, /Market.*-\$60\.00/]);

	await chooseSelect(page, 'Period', 'Last month');
	await expect(page.getByText('No spending in this period.')).toBeVisible();

	// All time reaches back over the empty month to the spending again.
	await chooseSelect(page, 'Period', 'All time');
	await expect(table.locator('tfoot')).toContainText('$115.00');

	await expect(page.getByTestId('net-worth-current')).toHaveText('$885.00');
	await expect(page.getByTestId('net-worth-table').locator('tbody tr').first()).toContainText(
		'$885.00'
	);
});

test('scopes both reports with a custom range', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');

	await page.getByRole('link', { name: 'Reports' }).first().click();

	// A single month has no trend to draw, so the chart gives way to a hint.
	await expect(page.getByText('Pick a longer period to see the trend.')).toBeVisible();
	await expect(page.getByTestId('net-worth-chart')).toBeHidden();

	// Widening the period can't conjure history a new budget doesn't have, so the hint stops
	// asking for a longer one and says what is actually missing.
	await chooseSelect(page, 'Period', 'Last 12 months');
	await expect(page.getByTestId('net-worth-chart')).toBeHidden();
	await expect(page.getByText('Pick a longer period to see the trend.')).toBeHidden();
	await expect(page.getByText(/only covers one month so far/)).toBeVisible();
	await chooseSelect(page, 'Period', 'This month');

	await chooseSelect(page, 'Period', 'Custom');
	const dialog = page.getByRole('dialog');
	const today = new Date();
	const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
	await pickDate(dialog, 'From', `${month}-01`);
	await pickDate(dialog, 'To', `${month}-28`);
	await dialog.getByRole('button', { name: 'Apply' }).click();
	await expect(dialog).toBeHidden();

	await expect(page.getByTestId('spending-table').locator('tfoot')).toContainText('$60.00');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('reaches Reports from the bottom navigation', async ({ page }) => {
		await onboard(page);
		await spend(page, 'Market', '60', 'Groceries');
		await spend(page, 'Electric company', '90', 'Utilities');
		await page.getByRole('link', { name: 'Reports' }).click();
		// The period control is one row, so the report is on screen without scrolling past a filter.
		await expect(page.getByLabel('Period')).toBeVisible();
		await expect(page.getByTestId('spending-table')).toContainText('Groceries');
	});
});
