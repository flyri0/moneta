import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/** Whether a text field has the focus, which is what brings up a phone's keyboard. */
function typingFocused(page: import('@playwright/test').Page) {
	return page.evaluate(() => document.activeElement?.matches('input, textarea') ?? false);
}

test.describe('on phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('a dialog opens without focusing its first field', async ({ page }) => {
		await onboard(page);
		await page.getByRole('button', { name: 'Add group' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByLabel('Group name')).toBeVisible();
		await expect(dialog).toBeFocused();
		expect(await typingFocused(page)).toBe(false);
	});
});

test('a dialog focuses its first field on desktop', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Add group' }).click();
	await expect(page.getByRole('dialog').getByLabel('Group name')).toBeFocused();
});
