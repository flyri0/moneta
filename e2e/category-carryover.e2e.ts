import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test('rolls overspending over from the category sheet itself', async ({ page }) => {
	await onboard(page);
	const open = () =>
		categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	await open();
	const sheet = page.getByRole('dialog');
	const carryover = sheet.getByLabel('Roll overspending over');
	await expect(carryover).not.toBeChecked();
	await carryover.click();
	await expect(carryover).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	await open();
	await expect(carryover).toBeChecked();
	await sheet.getByRole('button', { name: 'Category settings' }).click();
	await expect(sheet.getByLabel('Roll overspending over')).toHaveCount(0);
});
