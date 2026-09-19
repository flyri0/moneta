import { expect, type Page } from '@playwright/test';

/** Creates a USD budget with a checking account holding $1,000. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await page.goto('/');
	await page.getByLabel('Budget name').fill(name);
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome to Moneta' })).toBeHidden();
}
