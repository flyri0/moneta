import { expect, test } from '@playwright/test';
import { chooseCombobox, onboard } from './helpers';

test('shows the register with balances, cleared toggles and search', async ({ page }) => {
	await onboard(page);
	await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');

	const row = page.getByTestId('register-row');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('Starting balance');
	await expect(row.getByTestId('register-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('register-balance')).toHaveText('$1,000.00');

	await row.getByRole('button', { name: 'Cleared' }).click();
	await expect(row.getByRole('button', { name: 'Cleared' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('No transactions.')).toBeVisible();
	await page.getByRole('searchbox').fill('');
	await expect(row).toHaveCount(1);
});

test('puts a new account starting balance in the chosen category, with no payee', async ({
	page
}) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Cash' }).click();
	await dialog.getByLabel('Account name').fill('Wallet');
	await dialog.getByLabel('Current balance').fill('50');
	await expect(dialog.getByLabel('Starting balance category')).toContainText('Starting Balance');
	await chooseCombobox(dialog, 'Starting balance category', 'Salary', 'Salary');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Wallet' })
		.getByRole('link')
		.click();
	const row = page.getByTestId('register-row');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('Starting balance');
	await expect(row).toContainText('Salary');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('shows category, memo and the split toggle on the register row', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).click();
		await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();

		await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		const dialog = page.getByRole('dialog');

		await chooseCombobox(dialog, 'Payee', 'Market', 'Market');
		await dialog.getByLabel('Amount', { exact: true }).fill('40');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
		await dialog.getByLabel('Memo').fill('Weekly run');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		const row = page.getByTestId('register-row').filter({ hasText: 'Market' });
		await expect(row).toContainText('Groceries');
		await expect(row).toContainText('Weekly run');

		await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		await chooseCombobox(dialog, 'Payee', 'Big Store', 'Big Store');
		await dialog.getByLabel('Amount', { exact: true }).fill('80');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
		await dialog.getByRole('button', { name: 'Split' }).click();
		await dialog.getByLabel('Amount for line 1').fill('50');
		await chooseCombobox(dialog, 'Category for line 2', 'Household', 'Household');
		await dialog.getByLabel('Amount for line 2').fill('30');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		const splitRow = page.getByTestId('register-row').filter({ hasText: 'Big Store' });
		await splitRow.getByRole('button', { name: 'Split (2)' }).click();
		await expect(splitRow.getByText('Household')).toBeVisible();
	});

	test('marks which direction the transaction form is set to', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).click();
		await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();

		await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		const outflow = dialog.getByRole('button', { name: 'Outflow' });
		const inflow = dialog.getByRole('button', { name: 'Inflow' });
		await expect(outflow).toHaveAttribute('aria-pressed', 'true');
		await expect(inflow).toHaveAttribute('aria-pressed', 'false');

		await inflow.click();
		await expect(inflow).toHaveAttribute('aria-pressed', 'true');
		await expect(outflow).toHaveAttribute('aria-pressed', 'false');
	});

	test('accounts and register never scroll sideways on small phones and can navigate back', async ({
		page
	}) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).click();

		const overflow = () =>
			page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);

		for (const width of [390, 320]) {
			await page.setViewportSize({ width, height: 844 });
			await expect(page.getByTestId('accounts-total-balance')).toBeVisible();
			expect(await overflow(), `accounts screen overflow at ${width}px`).toBeLessThanOrEqual(0);
		}

		await page.getByTestId('account-row').filter({ hasText: 'Checking' }).getByRole('link').click();
		await expect(page.getByTestId('register-title')).toHaveText('Checking');

		for (const width of [390, 320]) {
			await page.setViewportSize({ width, height: 844 });
			await expect(page.getByTestId('register-balance')).toBeVisible();
			expect(await overflow(), `register screen overflow at ${width}px`).toBeLessThanOrEqual(0);
		}

		await page.getByRole('link', { name: 'Accounts' }).first().click();
		await expect(page.getByTestId('accounts-total-balance')).toBeVisible();
	});
});
