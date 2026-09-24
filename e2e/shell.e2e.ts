import { expect, test } from '@playwright/test';
import { chooseSelect, onboard } from './helpers';

test('navigates between screens and switches the language', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await chooseSelect(page, 'Language', 'Português (Brasil)');
	await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
	await page.getByRole('link', { name: 'Orçamento' }).first().click();
	await expect(page.getByText('Pronto para atribuir').first()).toBeVisible();
});

test('shows the date picker calendar in the UI language', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await chooseSelect(page, 'Language', 'Português (Brasil)');
	await page
		.getByRole('complementary')
		.getByRole('button', { name: 'Transação', exact: true })
		.click();
	await page.getByRole('dialog').getByLabel('Data').click();

	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	await expect(popover.locator('[data-calendar-head-cell]')).toHaveText([
		'dom',
		'seg',
		'ter',
		'qua',
		'qui',
		'sex',
		'sáb'
	]);
	const clipped = await popover
		.locator('[data-calendar-head-cell]')
		.evaluateAll((els) =>
			els.filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent)
		);
	expect(clipped).toEqual([]);
	const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
	await expect(popover.locator('[data-calendar-header]')).toContainText(month);
});

test('adds, closes and protects accounts', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await page.getByRole('button', { name: 'Add account' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Savings' }).click();
	await dialog.getByLabel('Account name').fill('Old savings');
	await dialog.getByRole('button', { name: 'Add account' }).click();
	await expect(dialog).toBeHidden();

	const main = page.getByRole('main');
	await main.getByRole('button', { name: 'Settings for Old savings' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog).toBeHidden();
	await expect(main.getByRole('region', { name: 'Closed' })).toContainText('Old savings');

	await main.getByRole('button', { name: 'Settings for Checking' }).click();
	await dialog.getByRole('button', { name: 'Close account' }).click();
	await expect(dialog.getByRole('alert')).toHaveText(
		'Only accounts with a zero balance can be closed.'
	);
});

test('puts the add-transaction button in the sidebar on desktop', async ({ page }) => {
	await onboard(page);
	const sidebar = page.getByRole('complementary');
	await expect(sidebar.getByRole('button', { name: 'Transaction', exact: true })).toBeVisible();
	await expect(page.getByRole('main').getByRole('button', { name: 'Transaction' })).toHaveCount(0);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('floats the add-transaction button above the bottom navigation bar', async ({ page }) => {
		await onboard(page);
		const bar = page.getByRole('navigation', { name: 'Main' });
		await expect(bar.getByRole('button', { name: 'Transaction', exact: true })).toHaveCount(0);
		const add = page.getByRole('button', { name: 'Transaction', exact: true });
		await expect(add).toBeVisible();

		const bounds = (await bar.boundingBox())!;
		const button = (await add.boundingBox())!;
		expect(button.y + button.height).toBeLessThan(bounds.y);
		expect(button.x + button.width).toBeGreaterThan(bounds.x + bounds.width * 0.75);

		await add.click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('keeps every bottom-bar label inside its slot in Portuguese', async ({ page }) => {
		await onboard(page);
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('button', { name: 'More' })
			.click();
		await page.getByRole('dialog').getByRole('link', { name: 'Settings' }).click();
		await chooseSelect(page, 'Language', 'Português (Brasil)');
		const bar = page.getByRole('navigation', { name: 'Principal' });
		// The active item is bolder, so measure with the longest label active.
		await bar.getByRole('link', { name: 'Orçamento' }).click();

		for (const width of [390, 320]) {
			await page.setViewportSize({ width, height: 844 });
			const labels = bar.locator('[data-nav-label]');
			await expect(labels).toHaveCount(5);
			const clipped = await labels.evaluateAll((els) =>
				els
					.filter(
						(el) =>
							el.scrollWidth > el.clientWidth ||
							el.parentElement!.scrollWidth > el.parentElement!.clientWidth
					)
					.map((el) => el.textContent)
			);
			expect(clipped, `labels clipped or overflowing at ${width}px`).toEqual([]);
		}
	});
});
