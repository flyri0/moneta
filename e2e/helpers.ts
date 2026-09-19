import { expect, type Page } from '@playwright/test';

/** Creates a USD budget with a checking account holding $1,000 and lands on the budget screen. */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await page.goto('/');
	await page.getByLabel('Budget name').fill(name);
	await page.getByLabel('Number and date format').selectOption('en-US');
	await page.getByLabel('Currency').selectOption('USD');
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
}

export function categoryRow(page: Page, name: string) {
	return page.getByTestId('category-row').filter({ hasText: name });
}
