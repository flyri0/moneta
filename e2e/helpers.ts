import { expect, type Locator, type Page } from '@playwright/test';

export function nextStep(page: Page) {
	return page.getByRole('button', { name: 'Next' });
}

/** Selects an option from a shadcn Select dropdown. */
export async function chooseSelect(
	container: Page | Locator,
	label: string | RegExp,
	optionText: string | RegExp
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	const trigger = container.getByLabel(label, { exact: false });
	await trigger.click();
	const content = page.locator('[data-slot="select-content"][data-state="open"]');
	await content
		.locator('[data-slot="select-item"]')
		.filter({ hasText: optionText })
		.first()
		.click();
	await expect(content).toBeHidden();
}

/** Selects an option from a shadcn Combobox. */
export async function chooseCombobox(
	container: Page | Locator,
	label: string | RegExp,
	itemText: string | RegExp,
	search?: string
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	const trigger = container.getByLabel(label, { exact: false });
	await trigger.click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	if (search) {
		await popover.locator('[data-slot="command-input"]').fill(search);
	}
	await popover.locator('[data-slot="command-item"]').filter({ hasText: itemText }).first().click();
	await expect(popover).toBeHidden();
}

/** Picks a date using the custom DatePicker. */
export async function pickDate(
	container: Page | Locator,
	label: string | RegExp,
	dateStr: string // 'YYYY-MM-DD'
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	const trigger = container.getByLabel(label, { exact: false });
	await trigger.click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	const [y, m, d] = dateStr.split('-').map(Number);
	// Click Year select if needed
	const yearSelect = popover.getByLabel('Year');
	if (await yearSelect.isVisible()) {
		await yearSelect.click();
		await page
			.locator('[data-slot="select-content"][data-state="open"]')
			.locator('[data-slot="select-item"]')
			.filter({ hasText: String(y) })
			.first()
			.click();
	}
	// Click Month select if needed
	const monthSelect = popover.getByLabel('Month');
	if (await monthSelect.isVisible()) {
		await monthSelect.click();
		await page
			.locator('[data-slot="select-content"][data-state="open"]')
			.locator('[data-slot="select-item"]')
			.nth(m - 1)
			.click();
	}
	// Click day in calendar
	await popover
		.locator('[data-slot="calendar-day"]')
		.filter({ hasText: new RegExp(`^${d}$`) })
		.first()
		.click();
	await expect(popover).toBeHidden();
}

/**
 * Walks the budget, categories and account steps (USD, en-US, the starter categories, a checking
 * account) and creates the budget. Expects the budget step to be showing.
 */
export async function fillNewBudget(page: Page, name: string, balance: string): Promise<void> {
	await page.getByLabel('Budget name').fill(name);
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();
	await nextStep(page).click();
	await page.getByRole('button', { name: 'Checking' }).click();
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill(balance);
	await page.getByRole('button', { name: 'Create budget' }).click();
}

/** Chooses the browser on the welcome page and gets past the warning about it. */
export async function useInBrowser(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Use it in the browser' }).click();
	await page.getByRole('button', { name: 'Continue in the browser' }).click();
}

/** Opens Moneta and leaves the welcome page for the app itself. */
export async function startApp(page: Page): Promise<void> {
	await page.goto('/');
	await useInBrowser(page);
}

/** Skips the two steps that explain the app, leaving onboarding on the budget step. */
export async function skipIntro(page: Page): Promise<void> {
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	await nextStep(page).click();
	await nextStep(page).click();
}

/** Creates a USD budget with a checking account holding $1,000 and lands on the budget screen. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await startApp(page);
	await skipIntro(page);
	await fillNewBudget(page, name, '1000');
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
}

export function categoryRow(page: Page, name: string) {
	return page.getByTestId('category-row').filter({ hasText: name });
}

export async function openSettings(page: Page): Promise<void> {
	// Phones keep Settings in the bottom bar's More sheet.
	if (page.viewportSize()!.width < 768) {
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('button', { name: 'More' })
			.click();
		await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
	} else {
		await page.getByRole('link', { name: 'Settings' }).first().click();
	}
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

/** Deletes a budget through its confirmation: type the name, tap, wait, tap again. */
export async function deleteBudget(page: Page, name: string): Promise<void> {
	await page.getByRole('button', { name: `Delete ${name}` }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel(`Type ${name} to confirm`).fill(name);
	await dialog.getByRole('button', { name: 'Delete budget' }).click();
	await dialog.getByRole('button', { name: 'Tap again to delete' }).click({ timeout: 10_000 });
}

/** Enters an outflow of `amount` to `payee` in `category` from the transaction dialog. */
export async function spend(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', payee, payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await chooseCombobox(dialog, 'Category', category, category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

/** Makes reading a picked file named `unreadable.moneta` fail, as a file removed meanwhile does. */
export async function failReadingFiles(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const read = Blob.prototype.arrayBuffer;
		File.prototype.arrayBuffer = function (this: File) {
			return this.name === 'unreadable.moneta'
				? Promise.reject(new DOMException('The file could not be read.', 'NotReadableError'))
				: read.call(this);
		};
	});
}

/** A backup file whose reading fails once `failReadingFiles` ran. */
export const UNREADABLE_FILE = {
	name: 'unreadable.moneta',
	mimeType: 'application/octet-stream',
	buffer: Buffer.from('x')
};
