import { expect, test } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('quick assign fits in two short rows of the category sheet', async ({ page }) => {
	await onboard(page);
	const groceries = categoryRow(page, 'Groceries');
	await groceries.getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Assigned this month').fill('100');
	await sheet.getByRole('button', { name: 'Save' }).first().click();
	await expect(sheet).toBeHidden();

	await groceries.getByRole('button', { name: 'Groceries' }).click();
	// Read every position at once: the sheet may still be sliding in.
	const clear = sheet.getByRole('button', { name: 'Clear', exact: true });
	await expect(clear).toBeVisible();
	const rows = await sheet.evaluate((el) => {
		const top = (name: string) =>
			el.querySelector(`button[aria-label="${name}"]`)!.getBoundingClientRect().top;
		const clearButton = [...el.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Clear'
		)!;
		return {
			averages: [3, 6, 12].map((months) => top(`Average spent (${months} mo.)`)),
			clear: clearButton.getBoundingClientRect().top
		};
	});
	// The three averages share one row, below the other strategies.
	expect(new Set(rows.averages).size).toBe(1);
	expect(rows.clear).toBeLessThan(rows.averages[0]);

	await clear.click();
	await expect(sheet).toBeHidden();
	await expect(groceries.getByTestId('available')).toHaveText('$0.00');
});
