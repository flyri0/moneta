import { expect, test, type Page } from '@playwright/test';
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

test.describe('the desktop sidebar', () => {
	/** Drags the sidebar's edge to `x`, the way a pointer does. */
	async function dragEdge(page: Page, x: number) {
		const handle = page.getByRole('separator', { name: 'Resize sidebar' });
		const box = (await handle.boundingBox())!;
		const y = box.y + box.height / 2;
		await page.mouse.move(box.x + box.width / 2, y);
		await page.mouse.down();
		await page.mouse.move(x, y, { steps: 5 });
		await page.mouse.up();
	}

	function sidebarWidth(page: Page) {
		return async () => (await page.getByRole('complementary').boundingBox())!.width;
	}

	test('resizes up to a quarter of the window and snaps to icons', async ({ page }) => {
		await onboard(page);
		await dragEdge(page, 300);
		await expect.poll(sidebarWidth(page)).toBe(300);

		await dragEdge(page, 1000);
		await expect.poll(sidebarWidth(page)).toBe(page.viewportSize()!.width / 4);

		await dragEdge(page, 100);
		await expect.poll(sidebarWidth(page)).toBe(64);
		const sidebar = page.getByRole('complementary');
		await expect(sidebar.getByRole('link', { name: 'Budget' })).toBeVisible();

		await page.reload();
		await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
		await expect.poll(sidebarWidth(page)).toBe(64);
	});

	test('resizes from the keyboard', async ({ page }) => {
		await onboard(page);
		const handle = page.getByRole('separator', { name: 'Resize sidebar' });
		await handle.focus();
		await page.keyboard.press('ArrowLeft');
		await expect(handle).toHaveAttribute('aria-valuenow', '240');
		await expect.poll(sidebarWidth(page)).toBe(240);
		await page.keyboard.press('Enter');
		await expect(handle).toHaveAttribute('aria-valuenow', '64');
		await page.keyboard.press('ArrowRight');
		await expect(handle).toHaveAttribute('aria-valuenow', '240');
	});

	test('shows each account in a tooltip when collapsed to icons', async ({ page }) => {
		await onboard(page);
		const sidebar = page.getByRole('complementary');
		await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();

		const account = sidebar.getByRole('link', { name: 'Checking, $1,000.00' });
		await account.hover();
		const tooltip = page.locator('[data-slot="tooltip-content"]');
		await expect(tooltip).toContainText('Checking');
		await expect(tooltip.getByTestId('account-balance')).toHaveText('$1,000.00');

		await account.click();
		await expect(page.getByTestId('register-title')).toHaveText('Checking');
	});

	test('keeps a long balance on one line at the narrowest width', async ({ page }) => {
		await onboard(page);
		await page.getByRole('link', { name: 'Accounts' }).first().click();
		await page.getByRole('button', { name: 'Add account' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Credit card' }).click();
		await dialog.getByLabel('Account name').fill('A credit card with a long name');
		await dialog.getByLabel('Amount owed').fill('3001.55');
		await dialog.getByRole('button', { name: 'Add account' }).click();
		await expect(dialog).toBeHidden();

		await dragEdge(page, 150);
		await expect.poll(sidebarWidth(page)).toBe(208);
		const balances = page.getByRole('complementary').getByTestId('account-balance');
		await expect(balances.filter({ hasText: '-$3,001.55' })).toHaveCount(1);
		const broken = await balances.evaluateAll((els) =>
			els
				.filter((el) => {
					const edge = el.closest('aside')!.getBoundingClientRect().right;
					return el.getClientRects().length !== 1 || el.getBoundingClientRect().right > edge;
				})
				.map((el) => el.textContent)
		);
		expect(broken, 'balances wrapped or overflowing').toEqual([]);
	});
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
