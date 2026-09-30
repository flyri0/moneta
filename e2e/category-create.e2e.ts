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

/** Names a new group in a group combobox. */
async function newGroup(container: Locator, label: string, name: string) {
	await container.getByLabel(label, { exact: true }).click();
	const popover = container.page().locator('[data-slot="popover-content"][data-state="open"]');
	await popover.locator('[data-slot="command-input"]').fill(name);
	await popover
		.locator('[data-slot="command-item"]')
		.filter({ hasText: `New group "${name}"` })
		.click();
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

test("creates a category for a new account's starting balance", async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Cash' }).click();
	await dialog.getByLabel('Account name').fill('Wallet');
	await dialog.getByLabel('Current balance').fill('50');
	await newCategory(dialog, 'Starting balance category', 'Gifts', { new: 'Windfalls' });
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Wallet' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-row')).toContainText('Gifts');
	await openBudget(page);
	await expect(categoryRow(page, 'Gifts').getByTestId('available')).toHaveText('$50.00');
});

test("creates a payee's default category", async ({ page }) => {
	await onboard(page);
	const dialog = await startTransaction(page, 'Corner Shop', '10');
	await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Payees' }).first().click();
	const row = page.getByTestId('payee-row').filter({ hasText: 'Corner Shop' });
	await row.click();
	await newCategory(dialog, 'Default category', 'Snacks', { existing: 'Everyday' });
	await expect(row).toContainText('Default: Snacks');
});

test('moves money to a new category', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Assigned this month').fill('100');
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();

	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	await sheet.getByRole('button', { name: 'Move money' }).click();
	await newCategory(sheet, 'Other category', 'Travel', { new: 'Trips' });
	await sheet.getByLabel('Amount to move').fill('40');
	await sheet.getByRole('button', { name: 'Move', exact: true }).click();
	await expect(sheet).toBeHidden();

	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$60.00');
	await expect(categoryRow(page, 'Travel').getByTestId('available')).toHaveText('$40.00');
});

test('moves a category to a new group from its settings', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Category settings' }).click();
	await newGroup(sheet, 'Group', 'Food');
	await expect(sheet.getByLabel('Group', { exact: true })).toHaveText('Food');
	await page.keyboard.press('Escape');

	const group = page.getByTestId('group-card').filter({ hasText: 'Food' });
	await expect(group.getByTestId('category-row').filter({ hasText: 'Groceries' })).toHaveCount(1);
});

test("moves a deleted group's categories to a new group", async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Everyday', exact: true }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Delete group' }).click();
	await newGroup(sheet, 'Move its categories to', 'Daily');
	await sheet.getByRole('button', { name: 'Delete group' }).click();
	await expect(sheet).toBeHidden();

	const group = page.getByTestId('group-card').filter({ hasText: 'Daily' });
	await expect(group.getByTestId('category-row').filter({ hasText: 'Groceries' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Everyday', exact: true })).toHaveCount(0);
});

test.describe('on phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps the keyboard down until the search is tapped, and offers to create first', async ({
		page
	}) => {
		await onboard(page);
		const dialog = await startTransaction(page, 'Market', '20');
		await dialog.getByLabel('Category', { exact: true }).click();
		const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
		const input = popover.locator('[data-slot="command-input"]');
		await expect(popover).toBeVisible();
		await expect(input).not.toBeFocused();

		await input.fill('Gro');
		const items = popover.locator('[data-slot="command-item"]');
		await expect(items.first()).toHaveText('Create category "Gro"');
		await items.first().click();
		await expect(popover.getByText('Add "Gro" to…')).toBeVisible();
		await expect(input).not.toBeFocused();
	});
});

test('focuses the search and lists the matches before creating on desktop', async ({ page }) => {
	await onboard(page);
	const dialog = await startTransaction(page, 'Market', '20');
	await dialog.getByLabel('Category', { exact: true }).click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	const input = popover.locator('[data-slot="command-input"]');
	await expect(input).toBeFocused();

	await input.fill('Gro');
	const items = popover.locator('[data-slot="command-item"]');
	await expect(items.filter({ hasText: 'Groceries' })).toHaveCount(1);
	await expect(items.last()).toHaveText('Create category "Gro"');
});
