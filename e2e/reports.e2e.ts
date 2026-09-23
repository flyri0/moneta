import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, chooseSelect, onboard, pickDate } from './helpers';

async function spend(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', payee, payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await chooseCombobox(dialog, 'Category', category, category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
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
	const months = netWorthCard.getByTestId('cash-flow-mini').getByRole('listitem');
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
	await expect(page.getByTestId('cash-flow-chart')).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL(/\/reports$/);
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
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
				'the cards push the page sideways'
			).toBe(true);

			await page.goto('/reports/net-worth');
			await page.locator('#report-period').click();
			await page
				.locator('[data-slot="select-item"]')
				.filter({ hasText: /Last 12 months|Últimos 12 meses/ })
				.click();

			await expect(page.getByTestId('net-worth-chart')).toBeVisible();
			await expect(page.getByTestId('cash-flow-chart')).toBeVisible();
			const table = page.getByTestId('net-worth-table');

			// Income and expenses move under the month, so the row has room for the net worth.
			await expect(table.getByRole('columnheader')).toHaveCount(2);

			// The charts lay themselves out after they mount, so wait for them to settle.
			await expect
				.poll(
					() =>
						page.evaluate(() =>
							['net-worth-chart', 'cash-flow-chart', 'net-worth-table', 'net-worth-tiles'].flatMap(
								(id) => {
									const card = document
										.querySelector(`[data-testid="${id}"]`)!
										.closest('.rounded-xl')!;
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
								}
							)
						),
					{ message: 'cells or axis labels outside their card' }
				)
				.toEqual([]);
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
