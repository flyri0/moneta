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
	// Dated on the bill, it waits apart from today's balance.
	await expect(page.getByTestId('register-balance')).toHaveText('$0.00');
	await expect(page.getByTestId('register-including-upcoming')).toHaveText('-$300.00');
	await expect(row.getByTestId('register-upcoming')).toHaveText('Upcoming');

	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	await expect(page.getByTestId('schedule-row')).toContainText('Nov 15, 2026');
});

test('adds a purchase already under way from the card purchase form, on the card’s due dates', async ({
	page
}) => {
	await page.clock.setFixedTime(new Date('2026-10-04T12:00:00'));
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
	await dialog.getByLabel('Closing day').fill('3');
	await dialog.getByLabel('Due day').fill('10');
	await dialog.getByLabel('Due day').press('Enter');
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await dialog.getByRole('button', { name: 'Already paying one? Add it as a schedule' }).click();
	await expect(page).toHaveURL(/\/transactions\/scheduled$/);
	await expect(dialog.getByRole('heading', { name: 'New schedule' })).toBeVisible();
	// Installments fall on the bill's due date, as a new purchase's do: the date isn't typed.
	await expect(dialog.getByLabel('Next date')).toHaveValue('Oct 10, 2026');
	await expect(dialog.getByTestId('installments-due')).toContainText('Oct 10, 2026');
	// One row for the repeat rule and installments: it says installments are on.
	await expect(dialog.getByRole('button', { name: /^Repeats/ })).toContainText('Installments');

	await chooseCombobox(dialog, 'Payee', 'TV Store', 'TV Store');
	await dialog.getByLabel('Amount', { exact: true }).fill('80');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByLabel('Memo').fill('TV');

	// Saving without the numbers opens their screen, with the error.
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByRole('heading', { name: 'Repeats' })).toBeVisible();
	await expect(dialog.getByText("Enter the next installment's number")).toBeVisible();
	await expect(dialog.getByRole('switch', { name: 'Installments' })).toBeChecked();
	await dialog.getByLabel('Next installment').fill('4');
	await dialog.getByLabel('Total installments').fill('12');
	await expect(dialog.getByTestId('installments-left')).toHaveText(
		'9 left, 4/12 to 12/12, every month · $720.00 in all'
	);
	await dialog.getByRole('button', { name: 'Back' }).click();
	await expect(dialog.getByRole('button', { name: /^Repeats/ })).toContainText(
		'Installment 4 of 12'
	);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const schedule = page.getByTestId('schedule-row');
	await expect(schedule).toContainText('TV Store');
	await expect(schedule).toContainText('-$80.00');
	await expect(schedule).toContainText('Installment 4 of 12');
	await expect(schedule).toContainText('Next Oct 10, 2026');

	// The link's query is gone from history too: going back and forth doesn't open it again.
	await page.goBack();
	await expect(page.getByTestId('register-title')).toHaveText('Visa');
	await page.goForward();
	await expect(schedule).toContainText('Installment 4 of 12');
	await expect(dialog).toBeHidden();

	// Nothing before it was entered.
	await page.reload();
	await expect(dialog).toBeHidden();
	await expect(schedule).toContainText('Installment 4 of 12');
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await expect(page.getByTestId('register-row').first()).toBeVisible();
	await expect(page.getByTestId('register-row').filter({ hasText: 'TV Store' })).toHaveCount(0);
});

test('offers installments in a schedule only for a card purchase', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Credit card' }).click();
	await dialog.getByLabel('Account name').fill('Visa');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	await page.getByRole('button', { name: 'Add schedule' }).first().click();
	const repeats = dialog.getByRole('button', { name: /^Repeats/ });
	const installments = dialog.getByRole('switch', { name: 'Installments' });
	const frequency = dialog.locator('#schedule-frequency');
	await repeats.click();
	await expect(frequency).toBeVisible();
	await expect(installments).toBeHidden();
	await dialog.getByRole('button', { name: 'Back' }).click();

	// A card purchase sets installments on the same screen as the repeat rule.
	await chooseCombobox(dialog, 'Account', 'Visa');
	await repeats.click();
	await installments.click();
	await expect(frequency).toBeHidden();
	await dialog.getByRole('button', { name: 'Back' }).click();
	await expect(repeats).toContainText('Installments');

	await chooseCombobox(dialog, 'Account', 'Checking');
	await expect(repeats).toContainText('Every month');
	await repeats.click();
	await expect(installments).toBeHidden();
	await expect(frequency).toBeVisible();
});
