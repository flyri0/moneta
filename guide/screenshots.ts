// Takes the guide's screenshots from the demo budget, in every language and theme, into guide/img/.
// Run with `pnpm guide:screenshots` (it builds the app first) after a change to one of these
// screens. Not part of the test suite.
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ptBR from '../src/core/i18n/messages/pt-BR.json' with { type: 'json' };

const OUT = join(import.meta.dirname, 'img');
const LOCALES = { en, 'pt-BR': ptBR } as const;
type Messages = typeof en;

for (const [locale, t] of Object.entries(LOCALES) as [keyof typeof LOCALES, Messages][]) {
	for (const scheme of ['light', 'dark'] as const) {
		test.describe(`${locale} ${scheme}`, () => {
			test.use({
				locale,
				colorScheme: scheme,
				viewport: { width: 1100, height: 900 },
				deviceScaleFactor: 2
			});

			/** `import-light.png`, or `import-light.pt-BR.png`: the names the guide's pages use. */
			const file = (name: string) =>
				join(OUT, `${name}-${scheme}${locale === 'en' ? '' : `.${locale}`}.png`);
			const shot = (target: Locator, name: string) =>
				target.screenshot({ path: file(name), animations: 'disabled' });
			/** A dialog alone, unfocused: the page behind it would show in its rounded corners. */
			const shotDialog = async (dialog: Locator, name: string) => {
				await dialog.page().evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
				await dialog.screenshot({
					path: file(name),
					animations: 'disabled',
					style:
						'body * { visibility: hidden } [role="dialog"], [role="dialog"] * { visibility: visible }'
				});
			};
			/** The page's main area down to `last`, without the empty space below it. */
			const shotUntil = async (page: Page, last: Locator, name: string) => {
				const main = (await page.getByRole('main').boundingBox())!;
				const end = (await last.boundingBox())!;
				await page.screenshot({
					path: file(name),
					animations: 'disabled',
					clip: {
						x: main.x,
						y: main.y,
						width: main.width,
						height: end.y + end.height + 24 - main.y
					}
				});
			};

			test('import review', async ({ page }) => {
				await openDemoAccount(page, t, t.demo_account_checking);
				// Entered by hand, so the statement's bakery line matches it.
				await page.getByRole('button', { name: t.add_transaction, exact: true }).first().click();
				const dialog = page.getByRole('dialog');
				await pick(dialog, t.transaction_payee, 'Padaria Central');
				await dialog.getByLabel(t.transaction_amount, { exact: true }).fill('45.90');
				await pick(dialog, t.transaction_category, t.default_category_groceries);
				await dialog.getByRole('button', { name: t.save }).click();
				await expect(dialog).toBeHidden();
				await page.getByTestId('import-file').setInputFiles(statement());
				await expect(page.getByTestId('import-row')).toHaveCount(4);
				await shotUntil(page, page.getByTestId('import-commit'), 'import');
			});

			test('reconcile', async ({ page }) => {
				await openDemoAccount(page, t, t.demo_account_checking);
				await page.getByRole('button', { name: t.reconcile, exact: true }).click();
				const dialog = page.getByRole('dialog');
				await expect(dialog.getByTestId('reconcile-cleared')).toBeVisible();
				await shot(dialog, 'reconcile');
			});

			test('installments', async ({ page }) => {
				await openDemoAccount(page, t, t.demo_account_card);
				await page.getByRole('button', { name: t.add_transaction, exact: true }).first().click();
				const dialog = page.getByRole('dialog');
				await pick(dialog, t.transaction_payee, 'TV');
				await dialog.getByLabel(t.transaction_amount, { exact: true }).fill('1000');
				await pick(dialog, t.transaction_category, t.default_category_household);
				await dialog.getByLabel(t.transaction_memo).fill('TV');
				await dialog.getByLabel(t.transaction_installments).fill('10');
				await expect(dialog.getByTestId('installment-plan')).toBeVisible();
				await shot(dialog, 'installments');
			});

			test('schedules', async ({ page }) => {
				await openDemo(page, t);
				await page.goto('/transactions/scheduled');
				await expect(page.getByTestId('schedule-row').first()).toBeVisible();
				await shotUntil(page, page.getByTestId('schedule-row').last(), 'schedules');
			});

			test('ready to assign', async ({ page }) => {
				await openDemo(page, t);
				await page.getByTestId('rta-amount').click();
				await expect(page.getByText(t.budget_funds_available)).toBeVisible();
				await shot(page.getByTestId('rta-card'), 'ready-to-assign');
			});

			test('category sheet', async ({ page }) => {
				await openDemo(page, t);
				const name = t.default_category_groceries;
				await page
					.getByTestId('category-row')
					.filter({ hasText: name })
					.getByRole('button', { name })
					.click();
				const dialog = page.getByRole('dialog');
				await expect(dialog.getByRole('button', { name: t.budget_move_money })).toBeVisible();
				await shotDialog(dialog, 'category');
			});

			test('split', async ({ page }) => {
				await openDemoAccount(page, t, t.demo_account_checking);
				await page.getByRole('button', { name: t.add_transaction, exact: true }).first().click();
				const dialog = page.getByRole('dialog');
				await pick(dialog, t.transaction_payee, t.demo_payee_grocery);
				await dialog.getByLabel(t.transaction_amount, { exact: true }).fill('80');
				await pick(dialog, t.transaction_category, t.default_category_groceries);
				await dialog.getByRole('button', { name: t.transaction_split }).click();
				await dialog.getByLabel(t.transaction_split_amount.replace('{line}', '1')).fill('50');
				await pick(
					dialog,
					t.transaction_split_category.replace('{line}', '2'),
					t.default_category_household
				);
				await dialog.getByLabel(t.transaction_split_amount.replace('{line}', '2')).fill('30');
				await expect(dialog.getByRole('button', { name: t.save })).toBeEnabled();
				await shotDialog(dialog, 'split');
			});

			test('account types', async ({ page }) => {
				await openDemo(page, t);
				await page.getByRole('link', { name: t.nav_accounts }).first().click();
				await page.getByRole('button', { name: t.accounts_add }).click();
				const dialog = page.getByRole('dialog');
				await expect(dialog.getByRole('button', { name: t.account_type_checking })).toBeVisible();
				await shotDialog(dialog, 'account-types');
			});

			test('csv columns', async ({ page }) => {
				await openDemoAccount(page, t, t.demo_account_checking);
				await page.getByTestId('import-file').setInputFiles(csvStatement());
				await expect(page.getByTestId('csv-preview').getByRole('listitem')).toHaveCount(3);
				const review = page.getByRole('button', { name: t.import_review.replace('{count}', '3') });
				await shotUntil(page, review, 'csv');
			});

			test('backup settings', async ({ page }) => {
				// The demo keeps no backups, so this one starts a budget of its own.
				await page.goto('/');
				await page.getByRole('button', { name: t.welcome_browser }).click();
				await page.getByRole('button', { name: t.welcome_browser_continue }).click();
				await page.getByRole('button', { name: t.onboarding_next }).click();
				await page.getByRole('button', { name: t.onboarding_next }).click();
				await page.getByLabel(t.onboarding_budget_name).fill(t.demo_account_checking);
				await page.getByRole('button', { name: t.onboarding_next }).click();
				await page.getByRole('button', { name: t.onboarding_next }).click();
				await page.getByRole('button', { name: t.onboarding_account_skip }).click();
				await page.getByRole('button', { name: t.onboarding_done_start }).click();
				await page.getByRole('link', { name: t.nav_settings }).first().click();
				const card = page.getByTestId('backup-card');
				await expect(card.getByTestId('last-backup')).toBeVisible();
				await shot(card, 'backup');
			});
		});
	}
}

async function openDemo(page: Page, t: Messages) {
	await page.goto('/');
	await page.getByRole('button', { name: t.welcome_demo }).click();
	await expect(page.getByTestId('rta-amount')).toBeVisible();
}

async function openDemoAccount(page: Page, t: Messages, name: string) {
	await openDemo(page, t);
	await page.getByRole('link', { name: t.nav_accounts }).first().click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: name })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-title')).toHaveText(name);
}

/** Picks `text` in a combobox, creating it when it doesn't exist. */
async function pick(dialog: Locator, label: string, text: string) {
	await dialog.getByLabel(label, { exact: false }).click();
	const popover = dialog.page().locator('[data-picker][data-state="open"]');
	await popover.locator('[data-slot="command-input"]').fill(text);
	await popover.locator('[data-slot="command-item"]').filter({ hasText: text }).first().click();
	await expect(popover).toBeHidden();
}

/**
 * A statement for the review: a bakery line that matches what was entered by hand, a line the
 * file repeats (the copy is already imported), and a new one.
 */
function statement() {
	const day = (offset: number) => {
		const date = new Date();
		date.setDate(date.getDate() - offset);
		return date.toISOString().slice(0, 10).replaceAll('-', '');
	};
	const line = (date: string, amount: string, id: string, name: string) =>
		`<STMTTRN><TRNTYPE>OTHER<DTPOSTED>${date}<TRNAMT>${amount}<FITID>${id}<NAME>${name}</STMTTRN>`;
	const text = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
${line(day(1), '-45.90', 'a1', 'PADARIA CENTRAL 0423')}
${line(day(2), '-129.00', 'a2', 'PAG*FARMACIA SAO JOAO')}
${line(day(2), '-129.00', 'a2', 'PAG*FARMACIA SAO JOAO')}
${line(day(3), '-18.50', 'a3', 'UBER *TRIP')}
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
	return { name: 'statement.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(text) };
}

/**
 * A bank's CSV export for the column step: a header, Brazilian amounts and last month's dates,
 * with days past the 12th so the day can't be read as a month.
 */
function csvStatement() {
	const day = (n: number) => {
		const date = new Date();
		date.setDate(1);
		date.setMonth(date.getMonth() - 1);
		date.setDate(n);
		return date.toLocaleDateString('pt-BR');
	};
	const text = `Data;Histórico;Valor
${day(22)};PADARIA CENTRAL 0423;-45,90
${day(18)};PAG*FARMACIA SAO JOAO;-129,00
${day(15)};SALARIO EMPRESA;3.200,00
`;
	return { name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(text) };
}
