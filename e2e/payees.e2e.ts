import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, onboard } from './helpers';

async function addTransaction(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', payee, payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await chooseCombobox(dialog, 'Category', category, category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('renames, merges, sets defaults for and removes payees', async ({ page }) => {
	await onboard(page);
	await addTransaction(page, 'Amzn', '10', 'Groceries');
	await addTransaction(page, 'Amazon', '20', 'Dining Out');
	await addTransaction(page, 'Typo shop', '5', 'Groceries');

	// Moving the last transaction to another payee leaves "Typo shop" unused.
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await page.getByTestId('register-row').getByRole('button', { name: 'Typo shop' }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Amazon', 'Amazon');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await sidebar.getByRole('link', { name: 'Payees' }).click();
	await expect(page.getByRole('heading', { name: 'Payees' })).toBeVisible();
	const rows = page.getByTestId('payee-row');
	await expect(rows).toHaveCount(3);
	await expect(rows.filter({ hasText: 'Amazon' })).toContainText('2 transactions');
	await expect(rows.filter({ hasText: 'Amzn' })).toContainText('1 transaction');
	await expect(rows.filter({ hasText: 'Typo shop' })).toContainText('Unused');

	// Renaming renames every past transaction.
	await rows.filter({ hasText: 'Amazon' }).click();
	await dialog.getByLabel('Payee name').fill('Amazon Store');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
	await expect(rows.filter({ hasText: 'Amazon Store' })).toBeVisible();

	// Renaming to a name that exists offers a merge.
	await rows.filter({ hasText: 'Amzn' }).click();
	await dialog.getByLabel('Payee name').fill('amazon store');
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Merge into Amazon Store' }).click();
	await expect(dialog.getByRole('heading', { name: 'Merge into Amazon Store?' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Merge', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(rows.filter({ hasText: 'Amzn' })).toHaveCount(0);
	await expect(rows.filter({ hasText: 'Amazon Store' })).toContainText('3 transactions');

	// The default category wins over the last one used (Groceries).
	await rows.filter({ hasText: 'Amazon Store' }).click();
	await chooseCombobox(dialog, 'Default category', 'Dining Out', 'Dining');
	await expect(rows.filter({ hasText: 'Amazon Store' })).toContainText('Default: Dining Out');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	await chooseCombobox(dialog, 'Payee', 'Amazon Store', 'Amazon Store');
	await expect(dialog.getByLabel('Category', { exact: true })).toContainText('Dining Out');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await sidebar.getByRole('link', { name: 'Transactions' }).click();
	await expect(
		page.getByTestId('register-row').getByRole('button', { name: 'Amazon Store' })
	).toHaveCount(3);

	// Unused payees go in one step.
	await sidebar.getByRole('link', { name: 'Payees' }).click();
	await page.getByRole('button', { name: 'Remove unused (1)' }).click();
	await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(rows.filter({ hasText: 'Typo shop' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Remove unused/ })).toBeHidden();

	await page.getByRole('searchbox').fill('store');
	await expect(rows).toHaveCount(1);
	await page.getByRole('searchbox').fill('nothing like this');
	await expect(page.getByText('No payees match “nothing like this”.')).toBeVisible();
});

test.describe('on a phone', () => {
	const long = 'Supermercado Pão de Açúcar Filial Centro';

	for (const [locale, width] of [
		['en', 390],
		['pt-BR', 390],
		['pt-BR', 320]
	] as const) {
		test(`the merge controls fit the sheet in ${locale} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 844 });
			await page.addInitScript((l) => localStorage.setItem('PARAGLIDE_LOCALE', l), locale);
			await page.goto('/');
			await page.getByRole('button', { name: /demo|demonstra/i }).click();
			await page.waitForURL(/\/budget\//);
			await page.goto('/payees');

			const rows = page.locator('button[data-testid="payee-row"]');
			const dialog = page.getByRole('dialog');
			/** Sideways scroll of the sheet and the page, and the controls that stick out of the sheet. */
			const overflow = () =>
				dialog.evaluate((sheet) => {
					const bounds = sheet.getBoundingClientRect();
					const outside = [...sheet.querySelectorAll('button, input')].filter((el) => {
						const box = el.getBoundingClientRect();
						return box.width > 0 && (box.left < bounds.left - 1 || box.right > bounds.right + 1);
					});
					return {
						sheet: sheet.scrollWidth - sheet.clientWidth,
						page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
						outside: outside.map((el) => el.textContent?.trim() || el.getAttribute('aria-label'))
					};
				});
			const fits = { sheet: 0, page: 0, outside: [] };

			// A long name, for the merge offer below.
			await rows.first().click();
			await dialog.locator('#payee-rename').fill(long);
			await dialog.locator('button[type="submit"]').click();
			await expect(dialog).toBeHidden();

			// The confirmation step of merging into another payee.
			await rows.filter({ hasText: long }).click();
			await chooseCombobox(dialog, /Merge with another payee|Mesclar com outro favorecido/, /./);
			await dialog.getByRole('button', { name: /^(Merge|Mesclar)$/ }).click();
			await expect(dialog.getByRole('button', { name: /^(Cancel|Cancelar)$/ })).toBeVisible();
			expect(await overflow(), 'merge confirmation').toEqual(fits);
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();

			// Renaming onto an existing payee offers a merge named after it.
			await rows.filter({ hasNotText: long }).first().click();
			await dialog.locator('#payee-rename').fill(long.toLowerCase());
			await expect(dialog.getByRole('button', { name: new RegExp(long) })).toBeVisible();
			expect(await overflow(), 'merge offer').toEqual(fits);
		});
	}
});
