import { expect, test } from '@playwright/test';
import { chooseCombobox, onboard } from './helpers';

test('pays a card purchase in installments: the first now, the rest scheduled', async ({
	page
}) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Credit card' }).click();
	await dialog.getByLabel('Account name').fill('Visa');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Visa' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-title')).toHaveText('Visa');
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await chooseCombobox(dialog, 'Payee', 'TV Store', 'TV Store');
	await dialog.getByLabel('Amount', { exact: true }).fill('1000');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByLabel('Memo').fill('TV');
	await dialog.getByLabel('Installments').fill('3');
	await expect(dialog.getByTestId('installment-plan')).toHaveText(
		'First $333.34, then 2 of $333.33'
	);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const row = page.getByTestId('register-row').filter({ hasText: 'TV Store' });
	await expect(row.getByTestId('register-amount')).toHaveText('-$333.34');
	await expect(row).toContainText('TV 1/3');
	await expect(page.getByTestId('register-balance')).toHaveText('-$333.34');

	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	const schedule = page.getByTestId('schedule-row');
	await expect(schedule).toContainText('TV Store');
	await expect(schedule).toContainText('-$333.33');
	await expect(schedule).toContainText('Installment 2 of 3');
});

test('puts the installments of a card with billing days on its bills’ due dates', async ({
	page
}) => {
	await page.clock.setFixedTime(new Date('2026-09-29T12:00:00'));
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Credit card' }).click();
	await dialog.getByLabel('Account name').fill('Visa');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Visa' })
		.getByRole('link')
		.click();
	await page.getByRole('main').getByRole('button', { name: 'Settings for Visa' }).click();
	// The name and the billing days share one form and one Save.
	await expect(dialog.getByRole('button', { name: 'Save' })).toHaveCount(1);
	await dialog.getByLabel('Closing day').fill('5');
	await dialog.getByLabel('Due day').press('Enter');
	await expect(dialog.getByText('Enter both days')).toBeVisible();
	await dialog.getByLabel('Due day').fill('15');
	await dialog.getByLabel('Due day').press('Enter');
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await chooseCombobox(dialog, 'Payee', 'TV Store', 'TV Store');
	await dialog.getByLabel('Amount', { exact: true }).fill('900');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByLabel('Memo').fill('TV');
	await dialog.getByLabel('Installments').fill('3');
	await expect(dialog.getByTestId('installment-plan')).toHaveText(
		'3 payments of $300.00 · first due Oct 15, 2026'
	);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const row = page.getByTestId('register-row').filter({ hasText: 'TV Store' });
	await expect(row).toContainText('TV 1/3');
	await expect(row).toContainText('Oct 15, 2026');

	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	await expect(page.getByTestId('schedule-row')).toContainText('Nov 15, 2026');
});
