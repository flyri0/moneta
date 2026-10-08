import { expect, test } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard, spend } from './helpers';

test('brings back a deleted transaction', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '40', 'Groceries');
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('-$40.00');

	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	const rows = page.getByTestId('register-row');
	await expect(rows).toHaveCount(2);
	await rows.filter({ hasText: 'Market' }).getByRole('button', { name: 'Market' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toContainText('You can undo it right after.');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toBeHidden();
	await expect(rows).toHaveCount(1);

	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Transaction deleted.');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(toast).toContainText('Undone.');
	await expect(rows).toHaveCount(2);
	await expect(rows.filter({ hasText: 'Market' })).toContainText('-$40.00');
});

test('takes back moved money', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Assigned this month').fill('100');
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();

	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	await sheet.getByRole('button', { name: 'Move money' }).click();
	await chooseCombobox(sheet, 'Other category', 'Household', 'Household');
	await sheet.getByLabel('Amount to move').fill('30');
	await sheet.getByRole('button', { name: 'Move', exact: true }).click();
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$30.00');

	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Moved $30.00 from Groceries to Household.');
	// The earlier "assigned" toast is replaced: only the latest write can be taken back.
	const undoButton = toast.getByRole('button', { name: 'Undo' });
	await expect(undoButton).toHaveCount(1);
	await undoButton.click();
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$0.00');
});

test('brings back a deleted schedule', async ({ page }) => {
	await onboard(page);
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	await page.getByRole('button', { name: 'Add schedule' }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Gym', 'Gym');
	await dialog.getByLabel('Amount', { exact: true }).fill('30');
	await chooseCombobox(dialog, 'Category', 'Rent', 'Rent');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const schedule = page.getByTestId('schedule-row');
	await schedule.click();
	await dialog.getByRole('button', { name: 'Delete schedule' }).click();
	await dialog.getByRole('button', { name: 'Delete schedule' }).click();
	await expect(dialog).toBeHidden();
	await expect(schedule).toHaveCount(0);

	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Schedule deleted.');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(toast).toContainText('Undone.');
	await expect(schedule).toContainText('Gym');
});

test('brings back a deleted category and the money that moved out of it', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('100');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(groceries.getByTestId('available')).toHaveText('$100.00');

	await groceries.getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Delete category' }).click();
	await chooseCombobox(sheet, 'Move everything to', 'Household', 'Household');
	await sheet.getByRole('button', { name: 'Delete category' }).click();
	await expect(sheet).toBeHidden();
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$100.00');

	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Category deleted.');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(toast).toContainText('Undone.');
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$0.00');
});

test('saving an amount unchanged offers nothing to undo', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	const assigned = sheet.getByLabel('Assigned this month');
	await assigned.fill('100+25.5');
	await expect(sheet.getByText('= $125.50')).toBeVisible();
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();
	const toast = page.getByRole('region', { name: /Notifications/ });
	await expect(toast).toContainText('Assigned $125.50 to Groceries.');
	await toast.getByRole('button', { name: 'Undo' }).waitFor();

	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();
	// The earlier toast still offers its Undo: nothing replaced it.
	await expect(toast.getByRole('button', { name: 'Undo' })).toHaveCount(1);
	await expect(toast).toContainText('Assigned $125.50 to Groceries.');
});
