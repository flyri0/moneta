import { expect, test, type Page } from '@playwright/test';
import { categoryRow, onboard } from './helpers';

/** The open emoji picker. */
function picker(page: Page) {
	return page.locator('[data-picker][data-state="open"]');
}

/** Waits for the picker to be gone, its closing animation included. */
async function closed(page: Page) {
	await expect(page.locator('[data-picker]')).toHaveCount(0);
}

test('gives a group an emoji found by name, and takes it away', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Fun', exact: true }).click();
	const sheet = page.getByRole('dialog').first();
	await sheet.getByRole('button', { name: 'Group settings' }).click();
	await sheet.getByRole('combobox', { name: 'Icon' }).click();
	await picker(page).getByRole('searchbox', { name: 'Search emoji' }).fill('pizza');
	await picker(page).getByRole('button', { name: 'pizza', exact: true }).click();
	await closed(page);

	const fun = page.getByTestId('group-row').filter({ hasText: 'Fun' });
	await expect(fun).toContainText('🍕');
	// The icon is left out of the name.
	await expect(page.getByRole('button', { name: 'Fun', exact: true })).toBeVisible();

	await sheet.getByRole('button', { name: 'Remove icon' }).click();
	await expect(sheet.getByRole('combobox', { name: 'Icon' })).toHaveText('No icon');
	await expect(fun).not.toContainText('🍕');
});

test('gives the Income group an emoji, with nothing else to change', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Income', exact: true }).click();
	const sheet = page.getByRole('dialog').first();
	await expect(sheet.getByRole('button', { name: 'Delete group' })).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Group settings' }).click();
	await expect(sheet.getByLabel('Group name')).toHaveCount(0);
	await expect(sheet.getByLabel('Hidden')).toHaveCount(0);
	await sheet.getByRole('combobox', { name: 'Icon' }).click();
	await picker(page).getByRole('searchbox', { name: 'Search emoji' }).fill('money bag');
	await picker(page).getByRole('button', { name: 'money bag', exact: true }).click();
	await closed(page);

	await expect(page.getByTestId('group-row').filter({ hasText: 'Income' })).toContainText('💰');
});

test('gives a category an emoji in the chosen skin tone, and remembers both', async ({ page }) => {
	await onboard(page);
	await categoryRow(page, 'Groceries').getByRole('button', { name: 'Groceries' }).click();
	const sheet = page.getByRole('dialog').first();
	await sheet.getByRole('button', { name: 'Category settings' }).click();
	await sheet.getByRole('combobox', { name: 'Icon' }).click();

	await picker(page).getByRole('button', { name: 'Skin tone: Default' }).click();
	await picker(page).getByRole('radio', { name: 'Dark', exact: true }).click();
	await picker(page).getByRole('searchbox').fill('waving hand');
	await picker(page).getByRole('button', { name: 'waving hand', exact: true }).click();
	await expect(categoryRow(page, 'Groceries')).toContainText('👋🏿');
	await closed(page);

	// The tone and the emoji are there the next time.
	await sheet.getByRole('combobox', { name: 'Icon' }).click();
	await expect(picker(page).getByRole('button', { name: 'Skin tone: Dark' })).toBeVisible();
	const recent = picker(page).getByRole('region', { name: 'Recently used' });
	await expect(recent.getByRole('button', { name: 'waving hand' })).toHaveText('👋🏿');
});

test('picks with the keyboard alone, flags included', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	await page.getByRole('main').getByRole('button', { name: 'Settings for Checking' }).click();
	const dialog = page.getByRole('dialog');
	const field = dialog.getByRole('combobox', { name: 'Icon' });
	await field.click();
	const search = picker(page).getByRole('searchbox', { name: 'Search emoji' });
	await expect(search).toBeFocused();
	await search.fill('flag brazil');
	await search.press('Enter');
	await closed(page);
	await expect(field).toHaveText('🇧🇷');

	// Down from the search to the first emoji (the recent flag), then right to the first smiley.
	await field.click();
	const flag = picker(page).getByRole('button', { name: 'flag: Brazil' }).first();
	const grinning = picker(page).getByRole('button', { name: 'grinning face', exact: true });
	await search.press('ArrowDown');
	await expect(flag).toBeFocused();
	await flag.press('ArrowRight');
	await expect(grinning).toBeFocused();
	await grinning.press('Enter');
	await expect(field).toHaveText('😀');

	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('main')).toContainText('😀');
});

test('jumps to a group, and to the last emoji, before they are drawn', async ({ page }) => {
	await onboard(page);
	await page.getByRole('button', { name: 'Fun', exact: true }).click();
	const sheet = page.getByRole('dialog').first();
	await sheet.getByRole('button', { name: 'Group settings' }).click();
	await sheet.getByRole('combobox', { name: 'Icon' }).click();

	const tab = picker(page).getByRole('button', { name: 'Flags', exact: true });
	await tab.click();
	await expect(tab).toHaveAttribute('aria-current', 'true');
	const flags = picker(page).getByRole('region', { name: 'Flags', exact: true });
	await expect(flags.getByRole('button').first()).toBeInViewport({ ratio: 1 });

	await flags.getByRole('button').first().press('End');
	await expect(flags.getByRole('button').last()).toBeFocused();
	await expect(flags.getByRole('button').last()).toBeInViewport({ ratio: 1 });
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('picks from a screen of its own, by group', async ({ page }) => {
		await onboard(page);
		await page.getByRole('button', { name: 'Fun', exact: true }).click();
		const sheet = page.getByRole('dialog').first();
		await sheet.getByRole('button', { name: 'Group settings' }).click();
		await sheet.getByRole('combobox', { name: 'Icon' }).click();
		// Nothing brings the keyboard up by itself.
		await expect(picker(page).getByRole('searchbox')).not.toBeFocused();
		await picker(page).getByRole('button', { name: 'Activities' }).click();
		await picker(page).getByRole('button', { name: 'soccer ball' }).click();
		await closed(page);
		const fun = page
			.getByTestId('group-card')
			.filter({ has: page.getByRole('button', { name: 'Fun', exact: true }) });
		await expect(fun).toContainText('⚽');
	});
});
