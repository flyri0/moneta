import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test('shows the month with Ready to Assign and the starter categories', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$0.00');
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
});

test('sends invalid months to the current one', async ({ page }) => {
	await onboard(page);
	const current = page.url();
	await page.goto('/budget/9999-01');
	await expect(page).toHaveURL(current);
});

test('assigns inline with arithmetic on desktop', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('250+50');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(page.getByTestId('rta-amount')).toHaveText('$700.00');
	await expect(groceries.getByTestId('available')).toHaveText('$300.00');
});

test('quick-assign in a group leaves hidden categories untouched', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('100');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(groceries.getByTestId('available')).toHaveText('$100.00');

	await groceries.getByRole('button', { name: 'Groceries' }).click();
	const categorySheet = page.getByRole('dialog');
	await categorySheet.getByLabel('Hidden').click();
	await categorySheet.getByRole('button', { name: 'Save' }).last().click();
	await expect(categorySheet).toBeHidden();

	await page.getByRole('button', { name: /Hidden categories/ }).click();
	const hiddenGroceries = categoryRow(page, 'Groceries');
	await expect(hiddenGroceries.getByTestId('available')).toHaveText('$100.00');

	await page.getByRole('button', { name: 'Everyday', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
	await expect(hiddenGroceries.getByTestId('available')).toHaveText('$100.00');
});

test('collapses a group and remembers it across reloads', async ({ page }) => {
	await onboard(page);
	const everyday = page.getByTestId('group-row').filter({ hasText: 'Everyday' });
	await expect(categoryRow(page, 'Groceries')).toBeVisible();

	await page.getByRole('button', { name: 'Collapse Everyday' }).click();
	await expect(categoryRow(page, 'Groceries')).toBeHidden();
	await expect(everyday).toBeVisible();

	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(categoryRow(page, 'Groceries')).toBeHidden();

	await page.getByRole('button', { name: 'Collapse all' }).click();
	await expect(categoryRow(page, 'Rent or Mortgage')).toBeHidden();
	await page.getByRole('button', { name: 'Expand all' }).click();
	await expect(categoryRow(page, 'Groceries')).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('assigns and moves money from the category sheet', async ({ page }) => {
		await onboard(page);
		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		const sheet = page.getByRole('dialog');
		await sheet.getByLabel('Assigned this month').fill('120+35');
		await sheet.getByRole('button', { name: 'Save' }).first().click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$155.00');

		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		await sheet.getByLabel('Other category').selectOption({ label: 'Everyday · Household' });
		await sheet.getByLabel('Amount to move').fill('55');
		await sheet.getByRole('button', { name: 'Move', exact: true }).click();
		await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$100.00');
		await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$55.00');
	});

	test('shows how much of a category is spent', async ({ page }) => {
		await onboard(page);
		await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
		const sheet = page.getByRole('dialog');
		await sheet.getByLabel('Assigned this month').fill('300');
		await sheet.getByRole('button', { name: 'Save' }).first().click();
		await expect(sheet).toBeHidden();

		await page.getByRole('button', { name: 'Transaction', exact: true }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Account', { exact: true }).selectOption({ label: 'Checking' });
		await dialog.getByLabel('Payee').fill('Market');
		await dialog.getByLabel('Amount', { exact: true }).fill('240');
		await dialog.getByLabel('Category', { exact: true }).selectOption({ label: 'Groceries' });
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		const groceries = categoryRow(page, 'Groceries');
		await expect(groceries.getByTestId('available')).toHaveText('$60.00');
		await expect(groceries.getByTestId('progress')).toHaveText('$240.00 of $300.00 spent');
	});

	test('collapses a group from the card list', async ({ page }) => {
		await onboard(page);
		await expect(categoryRow(page, 'Groceries')).toBeVisible();

		await page.getByRole('button', { name: 'Collapse Everyday' }).click();
		await expect(categoryRow(page, 'Groceries')).toBeHidden();

		await page.getByRole('button', { name: 'Collapse all' }).click();
		await expect(categoryRow(page, 'Rent or Mortgage')).toBeHidden();
		await page.getByRole('button', { name: 'Expand all' }).click();
		await expect(categoryRow(page, 'Groceries')).toBeVisible();
	});

	test('never scrolls sideways', async ({ page }) => {
		await onboard(page);
		const overflow = () =>
			page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
		expect(await overflow()).toBeLessThanOrEqual(0);

		await page.setViewportSize({ width: 360, height: 640 });
		await expect(page.getByTestId('month-label')).toBeVisible();
		expect(await overflow()).toBeLessThanOrEqual(0);
	});
});

test('adds a group and a category, and reorders categories', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Add group' }).click();
	await page.getByRole('dialog').getByLabel('Group name').fill('Pets');
	await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
	await page.getByRole('button', { name: 'Pets', exact: true }).click();
	await page.getByRole('dialog').getByLabel('New category').fill('Vet');
	await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(categoryRow(page, 'Vet')).toBeVisible();

	await page.getByRole('button', { name: 'Edit order' }).click();
	await page.getByRole('button', { name: 'Move Household up' }).click();
	await page.getByRole('button', { name: 'Save' }).click();
	// Everyday was Groceries, Transportation, Dining Out, Household (rows 5-8 after Bills' four).
	const names = page.getByTestId('category-row').locator(':scope > button');
	await expect(names.nth(6)).toHaveText('Household');
	await expect(names.nth(7)).toHaveText('Dining Out');
});
