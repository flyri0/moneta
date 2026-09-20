import { expect, test } from '@playwright/test';
import { categoryRow, nextStep, onboard, skipIntro } from './helpers';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('onboarding seeds only the categories that were picked', async ({ page }) => {
	await page.goto('/');
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await nextStep(page).click();

	await page.getByRole('checkbox', { name: 'Fun', exact: true }).click();
	await page.getByLabel('Add a category — Goals').fill('New bike');
	await page.getByLabel('Add a category — Goals').press('Enter');
	await nextStep(page).click();

	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();

	await expect(categoryRow(page, 'Groceries')).toBeVisible();
	await expect(categoryRow(page, 'New bike')).toBeVisible();
	await expect(categoryRow(page, 'Entertainment')).toHaveCount(0);
	await expect(categoryRow(page, 'Hobbies')).toHaveCount(0);
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
