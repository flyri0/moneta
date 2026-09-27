import { expect, test, type Locator, type Page } from '@playwright/test';
import { categoryRow, chooseCombobox, onboard } from './helpers';

/** Creates a category from a category combobox, in an existing group or a new one. */
async function newCategory(
	container: Page | Locator,
	label: string,
	name: string,
	group: { existing: string } | { new: string }
) {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	await container.getByLabel(label, { exact: true }).click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	const input = popover.locator('[data-slot="command-input"]');
	await input.fill(name);
	await popover
		.locator('[data-slot="command-item"]')
		.filter({ hasText: `Create category "${name}"` })
		.click();
	await expect(popover.getByText(`Add "${name}" to…`)).toBeVisible();
	if ('existing' in group) {
		await popover.locator('[data-slot="command-item"]').filter({ hasText: group.existing }).click();
	} else {
		await input.fill(group.new);
		await popover
			.locator('[data-slot="command-item"]')
			.filter({ hasText: `New group "${group.new}"` })
			.click();
	}
	await expect(popover).toBeHidden();
}

async function startTransaction(page: Page, payee: string, amount: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', payee, payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	return dialog;
}

async function openBudget(page: Page) {
	await page.getByRole('link', { name: 'Budget' }).first().click();
	await expect(page.getByTestId('rta-amount')).toBeVisible();
}

for (const [device, viewport] of [
	['desktop', { width: 1280, height: 800 }],
	['phone', { width: 390, height: 844 }]
] as const) {
	test.describe(`on ${device}`, () => {
		test.use({ viewport });

		test('creates a category in an existing group when the transaction is saved', async ({
			page
		}) => {
			await onboard(page);
			const dialog = await startTransaction(page, 'Pet Shop', '45');
			await newCategory(dialog, 'Category', 'Pet', { existing: 'Everyday' });
			await expect(dialog.getByLabel('Category', { exact: true })).toHaveText('Pet');
			await dialog.getByRole('button', { name: 'Save' }).click();
			await expect(dialog).toBeHidden();

			await openBudget(page);
			const group = page.getByTestId('group-card').filter({ hasText: 'Everyday' });
			await expect(categoryRow(page, 'Pet').getByTestId('available')).toHaveText('-$45.00');
			await expect(group.getByTestId('category-row').filter({ hasText: 'Pet' })).toHaveCount(1);
		});
	});
}

test('creates a new group with its category', async ({ page }) => {
	await onboard(page);
	const dialog = await startTransaction(page, 'Clinic', '120');
	await newCategory(dialog, 'Category', 'Vet', { new: 'Pets' });
	await expect(dialog.getByLabel('Category', { exact: true })).toHaveText('Vet · Pets');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await openBudget(page);
	const group = page.getByTestId('group-card').filter({ hasText: 'Pets' });
	await expect(group.getByTestId('category-row').filter({ hasText: 'Vet' })).toHaveCount(1);
});

test('creates nothing when the transaction is cancelled', async ({ page }) => {
	await onboard(page);
	const dialog = await startTransaction(page, 'Boat Rental', '300');
	await newCategory(dialog, 'Category', 'Kayak', { new: 'Water' });
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await openBudget(page);
	await expect(categoryRow(page, 'Kayak')).toHaveCount(0);
	await expect(page.getByTestId('group-card').filter({ hasText: 'Water' })).toHaveCount(0);
});

test('creates a category for a split line', async ({ page }) => {
	await onboard(page);
	const dialog = await startTransaction(page, 'Big Store', '80');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByRole('button', { name: 'Split' }).click();
	await dialog.getByLabel('Amount for line 1').fill('50');
	await newCategory(dialog, 'Category for line 2', 'Garden', { existing: 'Everyday' });
	await dialog.getByLabel('Amount for line 2').fill('30');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await openBudget(page);
	await expect(categoryRow(page, 'Garden').getByTestId('available')).toHaveText('-$30.00');
});

test('creates a category for a reconciliation adjustment', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	await page.getByRole('button', { name: 'Reconcile' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'No' }).click();
	await dialog.getByLabel('Balance at the bank').fill('990');
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await newCategory(dialog, 'Category for the adjustment', 'Bank fees', { existing: 'Bills' });
	await dialog.getByRole('button', { name: 'Add adjustment and reconcile' }).click();
	await expect(dialog).toBeHidden();

	await expect(page.getByTestId('register-row').first()).toContainText('Bank fees');
});

test('creates a category on the import review and uses it for the rest', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	const now = new Date();
	const today = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, '0'),
		String(now.getDate()).padStart(2, '0')
	].join('-');
	await page.getByTestId('import-file').setInputFiles({
		name: 'extrato.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(`date,title,amount\n${today},Pet Shop,-12.50\n${today},Vet Clinic,-30.00\n`)
	});
	await page.getByRole('button', { name: 'Review lines (2)' }).click();

	await newCategory(page, 'Category for the rest', 'Pet', { new: 'Pets' });
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page.getByLabel('Category of line 2', { exact: true })).toHaveText('Pet · Pets');
	await page.getByTestId('import-commit').click();
	await expect(page.getByTestId('register-row')).toHaveCount(3);

	await openBudget(page);
	await expect(categoryRow(page, 'Pet').getByTestId('available')).toHaveText('-$42.50');
});
