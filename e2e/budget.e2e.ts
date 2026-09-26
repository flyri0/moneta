import { expect, test, type Locator, type Page } from '@playwright/test';
import { categoryRow, chooseCombobox, chooseSelect, onboard } from './helpers';

test('shows the month with Ready to Assign and the starter categories', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/\d{4}-\d{2}$/);
	await expect(categoryRow(page, 'Groceries').getByTestId('available')).toHaveText('$0.00');
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
});

test('renders RTA hero card and divided category group cards', async ({ page }) => {
	await onboard(page);
	const rtaCard = page.getByTestId('rta-card');
	await expect(rtaCard).toBeVisible();
	await expect(rtaCard.getByTestId('rta-amount')).toHaveText('$1,000.00');

	// Toggle RTA breakdown open and closed
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeVisible();
	await expect(page.getByText('Assigned this month')).toBeVisible();
	await page.getByTestId('rta-amount').click();
	await expect(page.getByText('Funds available')).toBeHidden();

	// Group card containers
	const groupCards = page.getByTestId('group-card');
	await expect(groupCards.first()).toBeVisible();
	await expect(groupCards.filter({ hasText: 'Everyday' })).toBeVisible();
});

test('shows Ready to Assign as done only at zero', async ({ page }) => {
	await onboard(page);
	const rtaCard = page.getByTestId('rta-card');
	await expect(rtaCard).toHaveAttribute('data-tone', 'unassigned');
	await expect(rtaCard.getByTestId('rta-hint')).toHaveText('Assign this money to your categories.');

	const assigned = categoryRow(page, 'Groceries').getByTestId('assigned');
	await assigned.fill('1000');
	await assigned.press('Enter');
	await expect(rtaCard).toHaveAttribute('data-tone', 'assigned');
	await expect(rtaCard.getByTestId('rta-hint')).toHaveText('All your money has a job.');

	await assigned.fill('1200');
	await assigned.press('Enter');
	await expect(rtaCard).toHaveAttribute('data-tone', 'overassigned');
	await expect(page.getByTestId('rta-amount')).toHaveText('-$200.00');
});

test('keeps an unassigned amount in the header once the card scrolls away', async ({ page }) => {
	await onboard(page);
	const chip = page.getByTestId('page-header').getByTestId('rta-chip');
	await expect(chip).toBeHidden();

	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await expect(chip).toHaveText('$1,000.00');
	await chip.click();
	await expect(page.getByTestId('rta-card')).toBeInViewport();
	await expect(chip).toBeHidden();

	const assigned = categoryRow(page, 'Groceries').getByTestId('assigned');
	await assigned.fill('1000');
	await assigned.press('Enter');
	await expect(page.getByTestId('rta-card')).toHaveAttribute('data-tone', 'assigned');
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await expect(page.getByTestId('rta-card')).not.toBeInViewport();
	await expect(chip).toBeHidden();
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
	await categorySheet.getByRole('button', { name: 'Category settings' }).click();
	// Settings save on their own: flipping the switch is enough.
	await categorySheet.getByLabel('Hidden').click();
	await expect(categorySheet.getByLabel('Hidden')).toBeChecked();
	await page.keyboard.press('Escape');
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
		await sheet.getByRole('button', { name: 'Move money' }).click();
		await chooseCombobox(sheet, 'Other category', 'Everyday · Household', 'Household');
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
		await chooseCombobox(dialog, 'Account', 'Checking', 'Checking');
		await chooseCombobox(dialog, 'Payee', 'Market', 'Market');
		await dialog.getByLabel('Amount', { exact: true }).fill('240');
		await chooseCombobox(dialog, 'Category', 'Groceries', 'Groceries');
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

	test('budget screen never scrolls sideways on small phones and cards are styled consistently', async ({
		page
	}) => {
		await onboard(page);
		const overflow = () =>
			page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);

		for (const width of [390, 360, 320]) {
			await page.setViewportSize({ width, height: 844 });
			await expect(page.getByTestId('rta-card')).toBeVisible();
			expect(await overflow(), `budget screen overflow at ${width}px`).toBeLessThanOrEqual(0);
		}

		// Expand RTA breakdown and check overflow
		await page.getByTestId('rta-amount').click();
		await expect(page.getByText('Funds available')).toBeVisible();
		for (const width of [390, 320]) {
			await page.setViewportSize({ width, height: 844 });
			expect(await overflow(), `expanded budget screen overflow at ${width}px`).toBeLessThanOrEqual(
				0
			);
		}
	});
});

test('renames a category from its settings and goes back', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Category settings' }).click();
	await expect(sheet.getByRole('heading', { name: 'Category settings' })).toBeVisible();
	await sheet.getByLabel('Name').fill('Food');
	await sheet.getByLabel('Name').press('Enter');
	await expect(categoryRow(page, 'Food')).toBeVisible();

	await sheet.getByRole('button', { name: 'Back' }).click();
	await expect(sheet.getByRole('heading', { name: 'Food' })).toBeVisible();
	await expect(sheet.getByLabel('Assigned this month')).toBeVisible();
});

test('deletes a category in use after choosing where its money goes', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByTestId('assigned').fill('100');
	await groceries.getByTestId('assigned').press('Enter');
	await expect(groceries.getByTestId('available')).toHaveText('$100.00');

	await groceries.getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Delete category' }).click();
	await expect(sheet.getByRole('heading', { name: 'Delete Groceries?' })).toBeVisible();
	await expect(sheet.getByText('This category is in use')).toBeVisible();
	const remove = sheet.getByRole('button', { name: 'Delete category' });
	await expect(remove).toBeDisabled();

	await chooseCombobox(sheet, 'Move everything to', 'Everyday · Household', 'Household');
	await remove.click();
	await expect(sheet).toBeHidden();
	await expect(categoryRow(page, 'Groceries')).toHaveCount(0);
	await expect(categoryRow(page, 'Household').getByTestId('available')).toHaveText('$100.00');
});

test('deletes a group after moving its categories to another group', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Everyday', exact: true }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: 'Delete group' }).click();
	await expect(sheet.getByText('This group has categories (4)')).toBeVisible();
	const remove = sheet.getByRole('button', { name: 'Delete group' });
	await expect(remove).toBeDisabled();

	await chooseSelect(sheet, 'Move its categories to', 'Bills');
	await remove.click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: 'Everyday', exact: true })).toHaveCount(0);
	const bills = page.getByTestId('group-card').filter({ hasText: 'Bills' });
	await expect(bills.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('adds a category to the Income group, which stays undeletable', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Income', exact: true }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByRole('button', { name: 'Delete group' })).toHaveCount(0);
	await sheet.getByLabel('New category').fill('Freelance');
	await sheet.getByRole('button', { name: 'Add', exact: true }).click();
	await page.keyboard.press('Escape');
	const income = page.getByTestId('group-card').filter({ hasText: 'Income' });
	await expect(income.getByTestId('category-row').filter({ hasText: 'Freelance' })).toBeVisible();
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
	// Everyday was Groceries, Transportation, Dining Out, Household; moving Household up swaps it with Dining Out.
	const everyday = page.getByTestId('group-card').filter({ hasText: 'Everyday' });
	const names = everyday.getByTestId('category-row').locator(':scope > button');
	await expect(names.nth(2)).toHaveText('Household');
	await expect(names.nth(3)).toHaveText('Dining Out');
});

/** Drags a grip with the mouse (the same Pointer Events path as touch) to `y`, in steps. */
/**
 * Drags `handle` to `y`. A function measures `y` once the drag is under way, from the middle of
 * the screen: starting near an edge scrolls the page, which moves the target.
 */
async function dragTo(page: Page, handle: Locator, y: number | (() => Promise<number>)) {
	await handle.scrollIntoViewIfNeeded();
	const box = (await handle.boundingBox())!;
	const x = box.x + box.width / 2;
	await page.mouse.move(x, box.y + box.height / 2);
	await page.mouse.down();
	if (typeof y === 'function') {
		await page.mouse.move(x, page.viewportSize()!.height / 2, { steps: 10 });
		y = await y();
	}
	await page.mouse.move(x, y, { steps: 20 });
	await page.mouse.up();
}

function orderSection(page: Page, name: string) {
	return page.locator('section[data-order-group]').filter({
		has: page.locator('[data-order-header]', { hasText: name })
	});
}

function orderCategory(page: Page, name: string) {
	return page.getByTestId('order-category').filter({ hasText: name });
}

test('drags a category into another group', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Edit order' }).click();
	await dragTo(page, orderCategory(page, 'Groceries').getByTestId('drag-handle'), async () => {
		const target = (await orderCategory(page, 'Rent').boundingBox())!;
		return target.y + target.height * 0.25;
	});
	await expect(orderSection(page, 'Bills').getByTestId('order-category').first()).toHaveText(
		'Groceries'
	);
	await page.getByRole('button', { name: 'Save' }).click();
	const bills = page.getByTestId('group-card').filter({ hasText: 'Bills' });
	await expect(bills.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('drags the Income group below the others and keeps it there', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Edit order' }).click();
	const sections = page.locator('section[data-order-group]');
	const last = sections.last();
	await dragTo(
		page,
		orderSection(page, 'Income').getByTestId('drag-handle').first(),
		(await last.boundingBox())!.y + 1000
	);
	await expect(sections.last()).toHaveAttribute('aria-label', 'Income');
	await expect(orderSection(page, 'Income').getByTestId('order-category')).toHaveText([
		'Salary',
		'Other Income',
		'Starting Balance'
	]);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('group-card').last()).toContainText('Income');
	await page.reload();
	await expect(page.getByTestId('group-card').last()).toContainText('Income');
	await expect(page.getByTestId('group-card').first()).not.toContainText('Income');
});

test('moves the Income group with its arrows', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Edit order' }).click();
	await page.getByRole('button', { name: 'Move Income down' }).click();
	await expect(page.locator('section[data-order-group]').nth(1)).toHaveAttribute(
		'aria-label',
		'Income'
	);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('group-card').nth(1)).toContainText('Income');
});

test('scrolls while a drag holds at the bottom edge, and Escape undoes it', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 500 });
	await onboard(page);
	await page.getByRole('button', { name: 'Edit order' }).click();
	const first = page.getByTestId('order-category').first();
	const name = (await first.innerText()).trim();
	const handle = first.getByTestId('drag-handle');
	await handle.scrollIntoViewIfNeeded();
	const box = (await handle.boundingBox())!;
	const start = await page.evaluate(() => window.scrollY);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, 430, { steps: 10 });
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(start + 100);
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await expect(page.getByTestId('order-category').first()).toHaveText(name);
});

test('picks month and year from the month reader date picker', async ({ page }) => {
	await onboard(page);
	await expect(page).toHaveURL(/\/budget\/(\d{4})-(\d{2})$/);
	const match = page.url().match(/\/budget\/(\d{4})-(\d{2})$/);
	const initialYear = Number(match![1]);

	await page.getByTestId('month-label').click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	await expect(popover).toBeVisible();

	await popover.getByRole('button', { name: 'Previous year' }).click();
	await popover.getByRole('button', { name: new RegExp(`January ${initialYear - 1}`) }).click();

	await expect(popover).toBeHidden();
	await expect(page).toHaveURL(new RegExp(`/budget/${initialYear - 1}-01$`));
	await expect(page.getByTestId('month-label')).toContainText(
		new RegExp(`January ${initialYear - 1}`)
	);
});
