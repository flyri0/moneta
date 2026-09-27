import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseCombobox, onboard, spend } from './helpers';

/** Picks from the combobox labelled exactly `label` (the payee dialog has several categories). */
async function pick(container: Locator, label: string, item: string) {
	await container.getByLabel(label, { exact: true }).click();
	const popover = container.page().locator('[data-slot="popover-content"][data-state="open"]');
	await popover.locator('[data-slot="command-input"]').fill(item);
	await popover.locator('[data-slot="command-item"]').filter({ hasText: item }).first().click();
	await expect(popover).toBeHidden();
}

function sidebar(page: Page) {
	return page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
}

async function openPayee(page: Page, name: string): Promise<Locator> {
	await sidebar(page).getByRole('link', { name: 'Payees' }).click();
	await page.getByTestId('payee-row').filter({ hasText: name }).click();
	return page.getByRole('dialog');
}

async function importCsv(page: Page, lines: string[]) {
	await sidebar(page).getByRole('link', { name: 'Accounts' }).click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
	const now = new Date();
	const today = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, '0'),
		String(now.getDate()).padStart(2, '0')
	].join('-');
	const body = lines.map((l) => `${today},${l}`).join('\n');
	await page.getByTestId('import-file').setInputFiles({
		name: 'statement.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(`date,title,amount\n${body}\n`)
	});
	await page.getByRole('button', { name: `Review lines (${lines.length})` }).click();
}

test('a rule set on a payee names and categorizes the lines it catches', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Uber', '10', 'Groceries');

	const dialog = await openPayee(page, 'Uber');
	await dialog.getByRole('button', { name: 'Add rule' }).click();
	await dialog.getByLabel('Text').fill('UBER');
	await pick(dialog, 'Category', 'Transportation');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByTestId('payee-rule')).toHaveText('Starts with “UBER”');
	await expect(dialog.getByTestId('payee-rules')).toContainText('Transportation');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('payee-row').filter({ hasText: 'Uber' })).toContainText('Rules: 1');

	await importCsv(page, ['UBER *TRIP 1,-12.50', 'UBER *EATS 2,-30.00']);
	const rows = page.getByTestId('import-row');
	await expect(rows.getByTestId('import-rule')).toHaveCount(2);
	await expect(rows.nth(0).getByLabel('Payee of line 1')).toHaveValue('Uber');
	await expect(rows.nth(1).getByLabel('Category of line 2', { exact: true })).toHaveText(
		'Transportation'
	);
	await expect(page.getByTestId('import-commit')).toHaveText('Import (2)');
	await page.getByTestId('import-commit').click();
	await expect(
		page
			.getByTestId('register-row')
			.filter({ hasText: 'Uber' })
			.filter({ hasText: 'Transportation' })
	).toHaveCount(2);
});

test('a rule made on the review applies to the other lines, and can be deleted', async ({
	page
}) => {
	await onboard(page);
	await importCsv(page, ['PADARIA X 123,-8.00', 'PADARIA X 456,-9.50', 'MERCADO,-20.00']);
	const rows = page.getByTestId('import-row');
	await rows.nth(0).getByLabel('Payee of line 1').fill('Padaria');
	await rows.nth(0).getByRole('button', { name: 'Make a rule' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog.getByLabel('Text')).toHaveValue('PADARIA X');
	await expect(dialog.getByTestId('rule-sample')).toHaveText('Catches “PADARIA X 123”.');
	await pick(dialog, 'Category', 'Groceries');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await expect(rows.nth(1).getByLabel('Payee of line 2')).toHaveValue('Padaria');
	await expect(rows.nth(1).getByTestId('import-rule')).toBeVisible();
	await expect(rows.nth(2).getByTestId('import-rule')).toHaveCount(0);
	await chooseCombobox(page, 'Category of line 3', 'Groceries', 'Groceries');
	await page.getByTestId('import-commit').click();
	await expect(page.getByTestId('register-row').filter({ hasText: 'Padaria' })).toHaveCount(2);

	const payee = await openPayee(page, 'Padaria');
	await expect(payee.getByTestId('payee-rule')).toHaveText('Starts with “PADARIA X”');
	await payee.getByRole('button', { name: 'Edit rule' }).click();
	await payee.getByRole('button', { name: 'Delete rule' }).click();
	await payee.getByRole('button', { name: 'Delete' }).click();
	await expect(payee.getByTestId('payee-rule')).toHaveCount(0);
});
