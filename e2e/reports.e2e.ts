import { expect, test, type Page } from '@playwright/test';
import { chooseSelect, onboard, pickDate, spend } from './helpers';

/** Fails unless every cell and axis label stays inside the card around each of `ids`. */
async function expectInsideCards(page: Page, ids: string[]) {
	// The charts lay themselves out after they mount, so wait for them to settle.
	await expect
		.poll(
			() =>
				page.evaluate(
					(ids) =>
						ids.flatMap((id) => {
							const card = document.querySelector(`[data-testid="${id}"]`)!.closest('.rounded-xl')!;
							const bounds = card.getBoundingClientRect();
							return [...card.querySelectorAll('.lc-axis-tick-label, td, th, dd')]
								.filter((el) => {
									const box = el.getBoundingClientRect();
									if (box.width === 0) return false; // hidden on a phone
									return (
										box.left < bounds.left ||
										box.right > bounds.right ||
										// SVG text reports meaningless scroll sizes, so only cells are clipped-checked.
										(el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1)
									);
								})
								.map((el) => el.textContent?.trim());
						}),
					ids
				),
			{ message: 'cells or axis labels outside their card' }
		)
		.toEqual([]);
}

/** Fails unless every card on the overview has the same height and nothing spills out of one. */
async function expectEvenCards(page: Page) {
	const sizes = await page
		.getByTestId('report-cards')
		.locator('> section')
		.evaluateAll((cards) =>
			cards.map((card) => ({
				height: Math.round(card.getBoundingClientRect().height),
				spills: card.scrollHeight > card.clientHeight + 1
			}))
		);
	expect(new Set(sizes.map((s) => s.height)).size, 'cards of different heights').toBe(1);
	expect(
		sizes.filter((s) => s.spills),
		'cards whose content is cut off'
	).toEqual([]);
}

test('shows each report as a card that opens the full report', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');
	await spend(page, 'Bistro', '40', 'Dining Out');
	await spend(page, 'Bakery', '15', 'Groceries');

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
	// The overview is a glance: the period control lives on the full reports.
	await expect(page.getByLabel('Period')).toHaveCount(0);

	const spendingCard = page.getByTestId('spending-card');
	await expect(spendingCard.getByTestId('spending-card-total')).toHaveText('$115.00');
	await expect(spendingCard.getByTestId('stacked-bar')).toHaveAccessibleName(
		'Spending breakdown: Groceries 65.2%, Dining Out 34.8%'
	);
	await expect(spendingCard.getByTestId('spending-card-legend').getByRole('listitem')).toHaveText([
		/Groceries.*\$75\.00.*65%/,
		/Dining Out.*\$40\.00.*35%/
	]);

	const netWorthCard = page.getByTestId('net-worth-card');
	await expect(netWorthCard.getByTestId('net-worth-card-value')).toHaveText('$885.00');
	// Six months of income against expenses; the starting balance is not income.
	const cashFlowCard = page.getByTestId('cash-flow-card');
	await expect(cashFlowCard.getByTestId('cash-flow-card-net')).toHaveText('-$115.00');
	const months = cashFlowCard.getByTestId('cash-flow-mini').getByRole('listitem');
	await expect(months).toHaveCount(6);
	await expect(months.last()).toContainText('income $0.00, expenses $115.00');

	// The whole card opens the full report, not just its title.
	await spendingCard.click();
	await expect(page).toHaveURL(/\/reports\/spending$/);
	await expect(page.getByRole('heading', { name: 'Spending by category', level: 1 })).toBeVisible();

	const table = page.getByTestId('spending-table');
	await expect(table.locator('tbody tr')).toHaveText([
		/Groceries.*\$75\.00.*65\.2%/,
		/Dining Out.*\$40\.00.*34\.8%/
	]);
	await expect(table.locator('tfoot')).toContainText('$115.00');

	await table.getByRole('button', { name: /Groceries/ }).click();
	const drill = page.getByRole('region', { name: 'Transactions in Groceries' });
	await expect(drill.getByRole('listitem')).toHaveText([/Bakery.*-\$15\.00/, /Market.*-\$60\.00/]);

	// Groups sum their categories, and a group has no transactions of its own to drill into.
	await page.getByRole('button', { name: 'Groups' }).click();
	await expect(drill).toBeHidden();
	await expect(table.locator('tbody tr')).toHaveCount(1);
	await expect(table.locator('tbody tr')).toContainText('$115.00');
	await page.getByRole('button', { name: 'Categories' }).click();

	await chooseSelect(page, 'Period', 'Last month');
	await expect(page.getByText('No spending in this period.')).toBeVisible();

	// All time reaches back over the empty month to the spending again.
	await chooseSelect(page, 'Period', 'All time');
	await expect(table.locator('tfoot')).toContainText('$115.00');

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await expect(page).toHaveURL(/\/reports$/);

	// The period picked on one report carries over to the other.
	await page.getByRole('link', { name: 'Net worth' }).click();
	await expect(page).toHaveURL(/\/reports\/net-worth$/);
	await expect(page.getByLabel('Period')).toHaveText('All time');
	await expect(page.getByTestId('net-worth-current')).toHaveText('$885.00');
	await expect(page.getByTestId('savings-rate')).toHaveText('—');
	await expect(page.getByTestId('net-worth-table').locator('tbody tr').first()).toContainText(
		/\$0\.00.*\$115\.00.*-\$115\.00.*\$885\.00/
	);
	await expect(page.getByTestId('cash-flow-chart')).toHaveCount(0);

	// Income against expenses has a report of its own.
	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Cash flow' }).click();
	await expect(page).toHaveURL(/\/reports\/cash-flow$/);
	await expect(page.getByTestId('cash-flow-net')).toHaveText('-$115.00');
	await expect(page.getByTestId('cash-flow-chart')).toBeVisible();
	await expect(page.getByTestId('cash-flow-table').locator('tbody tr').first()).toContainText(
		/\$0\.00.*\$115\.00.*-\$115\.00/
	);

	await page.goBack();
	await expect(page).toHaveURL(/\/reports$/);
});

test('opens the payee, trend and account reports from their cards', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');
	await spend(page, 'Bistro', '40', 'Dining Out');
	await spend(page, 'Market', '15', 'Groceries');
	await page.getByRole('link', { name: 'Reports' }).first().click();

	const payees = page.getByTestId('payees-card');
	await expect(payees.getByTestId('payees-card-total')).toHaveText('$115.00');
	await expect(payees.getByTestId('payees-card-legend').getByRole('listitem')).toHaveText([
		/Market.*\$75\.00.*65%/,
		/Bistro.*\$40\.00.*35%/
	]);
	await expect(page.getByTestId('category-trends-card-total')).toHaveText('$115.00');
	await expect(page.getByTestId('accounts-card-assets')).toContainText('$885.00');

	await payees.click();
	await expect(page).toHaveURL(/\/reports\/payees$/);
	await page
		.getByTestId('payees-table')
		.getByRole('button', { name: /Market/ })
		.click();
	const drill = page.getByRole('region', { name: 'Transactions with Market' });
	await expect(drill.getByRole('listitem')).toHaveText([/-\$15\.00/, /-\$60\.00/]);

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Spending trends' }).click();
	await expect(page.getByTestId('trends-table').locator('tbody tr')).toHaveText([
		// One month of spending has nothing earlier to compare against.
		/Groceries.*\$75\.00\s*—$/s,
		/Dining Out.*\$40\.00\s*—$/s
	]);

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Assets and debts by account' }).click();
	await expect(page.getByTestId('accounts-assets')).toContainText('$885.00');
	await expect(page.getByText('No debts. Nicely done.')).toBeVisible();
});

test('hides and reorders the report cards, remembering them', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Reports' }).first().click();
	const cards = page.getByTestId('report-cards').locator('> section');
	await expect(cards).toHaveCount(7);
	await expect(cards.first()).toHaveAttribute('data-testid', 'spending-card');

	await page.getByRole('button', { name: 'Customize' }).click();
	const editor = page.getByTestId('reports-editor');
	await editor.getByRole('switch', { name: 'Show Spending by category' }).click();
	await editor.getByRole('button', { name: 'Move Age of Money up' }).click();
	await editor.getByRole('button', { name: 'Save' }).click();
	await expect(editor).toBeHidden();

	await expect(cards).toHaveCount(6);
	await expect(cards.first()).toHaveAttribute('data-testid', 'net-worth-card');
	await expect(cards.nth(4)).toHaveAttribute('data-testid', 'age-of-money-card');

	// The hidden report is still one click away, at the end.
	await page.reload();
	await expect(cards).toHaveCount(6);
	await page.getByRole('button', { name: 'Hidden reports (1)' }).click();
	await expect(page.getByTestId('hidden-report-cards').getByTestId('spending-card')).toBeVisible();

	// Cancel leaves things as they were; restoring the default brings every card back in order.
	await page.getByRole('button', { name: 'Customize' }).click();
	await editor.getByRole('button', { name: 'Move Net worth down' }).click();
	await editor.getByRole('button', { name: 'Cancel' }).click();
	await expect(cards.first()).toHaveAttribute('data-testid', 'net-worth-card');
	await page.getByRole('button', { name: 'Customize' }).click();
	await editor.getByRole('button', { name: 'Restore default' }).click();
	await editor.getByRole('button', { name: 'Save' }).click();
	await expect(cards).toHaveCount(7);
	await expect(cards.first()).toHaveAttribute('data-testid', 'spending-card');
	await expect(page.getByRole('button', { name: /Hidden reports/ })).toHaveCount(0);
});

test('reorders the report cards by dragging', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('button', { name: 'Customize' }).click();
	const rows = page.getByTestId('report-row');
	const handle = rows.nth(2).getByTestId('drag-handle');
	const target = await rows.nth(0).boundingBox();
	const from = await handle.boundingBox();
	await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
	await page.mouse.down();
	await page.mouse.move(from!.x + from!.width / 2, target!.y + 4, { steps: 8 });
	await page.mouse.up();
	await expect(rows.first()).toContainText('Cash flow');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByTestId('report-cards').locator('> section').first()).toHaveAttribute(
		'data-testid',
		'cash-flow-card'
	);
});

test('scopes the full reports with a period, a custom one too', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');

	// Net worth opens on the six months its card shows. A new budget has only this one, and
	// widening the period can't conjure history, so the hint says what is actually missing.
	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Net worth' }).click();
	await expect(page.getByLabel('Period')).toHaveText('Last 6 months');
	await expect(page.getByTestId('net-worth-chart')).toBeHidden();
	await expect(page.getByText(/only covers one month so far/)).toBeVisible();

	// A single month has no trend to draw, so the chart gives way to a hint.
	await chooseSelect(page, 'Period', 'This month');
	await expect(page.getByText('Pick a longer period to see the trend.')).toBeVisible();

	await chooseSelect(page, 'Period', 'Custom');
	const dialog = page.getByRole('dialog');
	const today = new Date();
	const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
	await pickDate(dialog, 'From', `${month}-01`);
	await pickDate(dialog, 'To', `${month}-28`);
	await dialog.getByRole('button', { name: 'Apply' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('link', { name: 'Reports' }).first().click();
	await page.getByRole('link', { name: 'Spending by category' }).click();
	await expect(page.getByLabel('Period')).toHaveText('Custom');
	await expect(page.getByTestId('spending-table').locator('tfoot')).toContainText('$60.00');
});

test('opens Age of Money from its card, which waits for ten payments', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Market', '60', 'Groceries');

	await page.getByRole('link', { name: 'Reports' }).first().click();
	const card = page.getByTestId('age-of-money-card');
	await expect(card).toContainText('It shows up after 10 payments');

	await card.click();
	await expect(page).toHaveURL(/\/reports\/age-of-money$/);
	await expect(page.getByRole('heading', { name: 'Age of Money', level: 1 })).toBeVisible();
	await expect(page.getByText('It shows up after 10 payments')).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('reaches Reports from the bottom navigation', async ({ page }) => {
		await onboard(page);
		await spend(page, 'Market', '60', 'Groceries');
		await spend(page, 'Electric company', '90', 'Utilities');
		await page.getByRole('link', { name: 'Reports' }).click();
		await expect(page.getByTestId('spending-card')).toContainText('Groceries');
		await page.getByRole('link', { name: 'Spending by category' }).click();
		// The period control is one row, so the report is on screen without scrolling past a filter.
		await expect(page.getByLabel('Period')).toBeVisible();
		await expect(page.getByTestId('spending-table')).toContainText('Groceries');
	});

	for (const [locale, width] of [
		['en', 393],
		['pt-BR', 393],
		['pt-BR', 320]
	] as const) {
		test(`keeps the reports inside their bounds in ${locale} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 851 });
			await page.addInitScript((l) => localStorage.setItem('PARAGLIDE_LOCALE', l), locale);
			await page.goto('/');
			await page.getByRole('button', { name: /demo|demonstra/i }).click();
			await page.waitForURL(/\/budget\//);

			await page.goto('/reports');
			await expect(page.getByTestId('net-worth-card-value')).toBeVisible();
			await expect(page.getByTestId('spending-card-legend')).toBeVisible();
			await expect(page.getByTestId('age-of-money-card-value')).toBeVisible();
			await expect(page.getByTestId('payees-card-legend')).toBeVisible();
			await expect(page.getByTestId('trends-mini')).toBeVisible();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
				'the cards push the page sideways'
			).toBe(true);
			await expectEvenCards(page);
			await expectInsideCards(page, ['payees-card-legend']);

			// The editor's toolbar and rows fit a phone too.
			await page.getByRole('button', { name: /Customize|Personalizar/ }).click();
			await expect(page.getByTestId('reports-editor')).toBeVisible();
			expect(
				await page
					.getByTestId('reports-editor')
					.locator('button, [role="switch"]')
					.evaluateAll(
						(els) => els.filter((el) => el.getBoundingClientRect().right > innerWidth).length
					),
				'editor controls past the edge of the screen'
			).toBe(0);
			await page.getByRole('button', { name: /Cancel|Cancelar/ }).click();

			await page.goto('/reports/net-worth');
			await page.locator('#report-period').click();
			await page
				.locator('[data-slot="select-item"]')
				.filter({ hasText: /Last 12 months|Últimos 12 meses/ })
				.click();

			await expect(page.getByTestId('net-worth-chart')).toBeVisible();
			const table = page.getByTestId('net-worth-table');

			// Income and expenses move under the month, so the row has room for the net worth.
			await expect(table.getByRole('columnheader')).toHaveCount(2);

			await expectInsideCards(page, ['net-worth-chart', 'net-worth-table', 'net-worth-tiles']);

			await page.goto('/reports/cash-flow');
			await expect(page.getByTestId('cash-flow-chart')).toBeVisible();
			await expectInsideCards(page, [
				'cash-flow-chart',
				'net-flow-chart',
				'cash-flow-table',
				'cash-flow-tiles'
			]);

			await page.goto('/reports/category-trends');
			await expect(page.getByTestId('trends-chart')).toBeVisible();
			await expectInsideCards(page, ['trends-chart', 'trends-table']);

			await page.goto('/reports/payees');
			await expect(page.getByTestId('payees-table')).toBeVisible();
			await expectInsideCards(page, ['payees-table']);

			await page.goto('/reports/accounts');
			await expect(page.getByTestId('accounts-assets')).toBeVisible();
			await expectInsideCards(page, ['accounts-assets']);

			// The demo's year of history gives Age of Money something to draw.
			await page.goto('/reports/age-of-money');
			await expect(page.getByTestId('age-of-money-current')).toBeVisible();
			await expectInsideCards(page, ['age-of-money-chart', 'age-of-money-current']);
		});
	}
});

test.describe('in negative timezone on day 1 of month', () => {
	test.use({ timezoneId: 'America/Sao_Paulo' });

	test('shows current month in net worth report on day 1', async ({ page }) => {
		await page.clock.setFixedTime(new Date('2026-10-01T12:00:00-03:00'));
		await onboard(page);
		await page.getByRole('link', { name: 'Reports' }).first().click();
		await expect(page.getByTestId('net-worth-card-value')).toHaveText('$1,000.00');

		await page.getByRole('link', { name: 'Net worth' }).click();
		await expect(page.getByTestId('net-worth-current')).toHaveText('$1,000.00');
		const table = page.getByTestId('net-worth-table');
		await expect(table.locator('tbody tr')).toHaveCount(1);
		await expect(table.locator('tbody tr').first()).toContainText('$1,000.00');
		await expect(page.getByText('No transactions yet.')).toBeHidden();
	});
});
