import { expect, type Page } from '@playwright/test';

export function nextStep(page: Page) {
	return page.getByRole('button', { name: 'Next' });
}

/**
 * Walks the budget, categories and account steps (USD, en-US, the starter categories, a checking
 * account) and creates the budget. Expects the budget step to be showing.
 */
export async function fillNewBudget(page: Page, name: string, balance: string): Promise<void> {
	await page.getByLabel('Budget name').fill(name);
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await nextStep(page).click();
	await nextStep(page).click();
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill(balance);
	await page.getByRole('button', { name: 'Create budget' }).click();
}

/** Skips the two steps that explain the app, leaving onboarding on the budget step. */
export async function skipIntro(page: Page): Promise<void> {
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	await nextStep(page).click();
	await nextStep(page).click();
}

/** Creates a USD budget with a checking account holding $1,000 and lands on the budget screen. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await page.goto('/');
	await skipIntro(page);
	await fillNewBudget(page, name, '1000');
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
}

export function categoryRow(page: Page, name: string) {
	return page.getByTestId('category-row').filter({ hasText: name });
}

export async function openSettings(page: Page): Promise<void> {
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}
