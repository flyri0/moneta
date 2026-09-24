import { expect, test } from '@playwright/test';
import {
	categoryRow,
	chooseCombobox,
	chooseSelect,
	nextStep,
	onboard,
	openSettings,
	skipIntro,
	startApp
} from './helpers';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('onboarding seeds only the categories that were picked', async ({ page }) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();

	await page.getByRole('checkbox', { name: 'Fun', exact: true }).click();
	await page.getByLabel('Add a category — Goals').fill('New bike');
	await page.getByLabel('Add a category — Goals').press('Enter');
	await nextStep(page).click();

	await page.getByRole('button', { name: 'Checking' }).click();
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();

	await expect(categoryRow(page, 'Groceries')).toBeVisible();
	await expect(categoryRow(page, 'New bike')).toBeVisible();
	await expect(categoryRow(page, 'Entertainment')).toHaveCount(0);
	await expect(categoryRow(page, 'Hobbies')).toHaveCount(0);
});

test('onboarding can start with no account', async ({ page }) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();
	await nextStep(page).click();

	await page.getByRole('button', { name: 'Start with no account' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();

	await expect(page.getByTestId('rta-amount')).toHaveText('$0.00');
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(page.getByText('No accounts yet.')).toBeVisible();
});

test('a second tab waits until it takes over', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);

	const second = await context.newPage();
	await second.goto('/');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await second.getByRole('button', { name: 'Use Moneta here' }).click();
	await expect(second.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(first.getByText('Moneta is open in another tab')).toBeVisible();
});

test('onboarding allows choosing theme, accent, and language on the welcome step', async ({
	page
}) => {
	await startApp(page);
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();

	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'teal');

	await page.getByRole('button', { name: 'Violet' }).click();
	await page.getByRole('button', { name: 'Dark' }).click();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);

	await chooseSelect(page, 'Language', 'Português (Brasil)');
	await expect(page.getByText('Boas-vindas ao Moneta')).toBeVisible();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);

	await page.getByRole('button', { name: 'Avançar' }).click();
	await expect(page.getByText('Um ponto de atenção')).toBeVisible();
	await page.getByRole('button', { name: 'Avançar' }).click();
	await expect(page.getByLabel('Nome do orçamento')).toHaveValue('Meu orçamento');
});

test.describe('onboarding on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('picks an accent colour from a sheet during onboarding', async ({ page }) => {
		await startApp(page);
		await expect(page.getByText('Welcome to Moneta')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Amber' })).toBeHidden();

		await page.getByRole('button', { name: 'Accent color' }).click();
		await page.getByRole('button', { name: 'Amber' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber');
		await expect(page.getByRole('button', { name: 'Accent color' })).toContainText('Amber');
	});
});

test('restores a backup directly from the onboarding backups step', async ({
	context
}, testInfo) => {
	const page1 = await context.newPage();
	await onboard(page1);
	await openSettings(page1);
	const backup = testInfo.outputPath('backups-step-backup.moneta');
	const downloading = page1.waitForEvent('download');
	await page1.getByRole('button', { name: 'Back up now' }).click();
	const file = await downloading;
	await file.saveAs(backup);
	await page1.close();

	const cleanContext = await context.browser()!.newContext();
	const page2 = await cleanContext.newPage();
	await startApp(page2);
	await expect(page2.getByText('Welcome to Moneta')).toBeVisible();

	// Advance to Step 2 (Backups warning)
	await nextStep(page2).click();
	await expect(page2.getByText('One thing to know')).toBeVisible();
	await expect(page2.getByText('Already have a backup?')).toBeVisible();

	// Pick invalid file first to test inline error display on Step 2
	await page2.getByLabel('Restore from a backup').setInputFiles({
		name: 'invalid.sqlite',
		mimeType: 'application/vnd.sqlite3',
		buffer: Buffer.from('not a sqlite database')
	});
	await expect(page2.getByRole('alert')).toHaveText(
		"That file isn't a Moneta backup (.moneta or .sqlite)."
	);

	// Pick valid backup to restore
	await page2.getByLabel('Restore from a backup').setInputFiles(backup);
	await expect(page2.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(categoryRow(page2, 'Groceries')).toBeVisible();
	await cleanContext.close();
});
