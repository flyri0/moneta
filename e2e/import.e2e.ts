import { expect, test, type Page } from '@playwright/test';
import { chooseCombobox, onboard, spend } from './helpers';

/** Today as the browser's local date, in `sep`-joined year, month and day. */
function today(): { y: string; m: string; d: string } {
	const now = new Date();
	return {
		y: String(now.getFullYear()),
		m: String(now.getMonth() + 1).padStart(2, '0'),
		d: String(now.getDate()).padStart(2, '0')
	};
}

function ofxFile(): { name: string; mimeType: string; buffer: Buffer } {
	const { y, m, d } = today();
	const date = `${y}${m}${d}`;
	const text = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${date}<TRNAMT>-45.90<FITID>1<MEMO>PADARIA CENTRAL</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${date}<TRNAMT>-120.00<FITID>2<MEMO>SUPERMERCADO BOM</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${date}<TRNAMT>3500.00<FITID>3<NAME>ACME PAYROLL</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>4334.10<DTASOF>${date}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
	return {
		name: 'statement.ofx',
		mimeType: 'application/x-ofx',
		buffer: Buffer.from(text, 'latin1')
	};
}

async function openChecking(page: Page) {
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
}

async function importFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
	await page.getByTestId('import-file').setInputFiles(file);
	await expect(page.getByRole('heading', { name: 'Import statement' })).toBeVisible();
}

test('imports an OFX statement, matches what was entered and reconciles', async ({ page }) => {
	await onboard(page);
	await spend(page, 'Bakery', '45.90', 'Groceries');
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await openChecking(page);

	await importFile(page, ofxFile());
	const rows = page.getByTestId('import-row');
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(0).getByTestId('import-match')).toContainText('Bakery');
	await expect(page.getByTestId('import-missing')).toContainText('2');
	const commit = page.getByTestId('import-commit');
	await expect(commit).toBeDisabled();

	await chooseCombobox(page, 'Category of line 2', 'Groceries', 'Groceries');
	await chooseCombobox(page, 'Category for the rest', 'Salary', 'Salary');
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(commit).toHaveText('Import (3)');
	await commit.click();

	await expect(page.getByTestId('register-title')).toHaveText('Checking');
	await expect(page.getByText('Imported: 2 new, 1 matched.')).toBeVisible();
	await expect(page.getByTestId('register-row')).toHaveCount(4);
	await expect(page.getByTestId('register-balance')).toHaveText('$4,334.10');

	// The statement's balance fills in the reconciliation.
	await page
		.getByRole('region', { name: /Notifications/ })
		.getByRole('button', { name: 'Reconcile' })
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByLabel('Balance at the bank')).toHaveValue('4334.10');
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('register-reconciled')).toHaveCount(4);

	// The same statement again adds nothing.
	await importFile(page, ofxFile());
	await expect(page.getByText('Already imported')).toHaveCount(3);
	await expect(page.getByTestId('import-commit')).toBeDisabled();
});

test('maps a CSV once and remembers the columns', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await openChecking(page);

	const { y, m, d } = today();
	const csv = {
		name: 'extrato.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(
			`Data;Histórico;Valor\n${d}/${m}/${y};Farmácia São João;-1.234,56\n${d}/${m}/${y};Café;-5,00\n`,
			'latin1'
		)
	};
	await importFile(page, csv);
	const preview = page.getByTestId('csv-preview');
	await expect(preview.getByRole('listitem')).toHaveCount(2);
	await expect(preview).toContainText('Farmácia São João');
	await expect(preview).toContainText('-$1,234.56');
	await page.getByRole('button', { name: 'Review lines (2)' }).click();

	await chooseCombobox(page, 'Category for the rest', 'Groceries', 'Groceries');
	await page.getByRole('button', { name: 'Apply' }).click();
	await page.getByTestId('import-commit').click();
	await expect(page.getByTestId('register-row')).toHaveCount(3);
	await expect(page.getByTestId('register-balance')).toHaveText('-$239.56');

	// The columns come back as they were; the lines are already imported.
	await importFile(page, csv);
	await expect(page.getByLabel('Amount', { exact: true })).toContainText('Valor');
	await page.getByRole('button', { name: 'Review lines (2)' }).click();
	await expect(page.getByText('Already imported')).toHaveCount(2);
});

test('leaves the CSV columns step without importing', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await openChecking(page);
	const account = page.url();
	const { y, m, d } = today();
	await importFile(page, {
		name: 'extrato.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(`Data;Histórico;Valor\n${d}/${m}/${y};Café;-5,00\n`, 'latin1')
	});
	await expect(page.getByTestId('csv-preview')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page).toHaveURL(account);
	await expect(page.getByTestId('register-row')).toHaveCount(1);
});

test('opens a line to show its whole description and edit its payee', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await openChecking(page);
	const { y, m, d } = today();
	const long =
		'PIX ENVIADO MARIA DA SILVA SANTOS OLIVEIRA CPF ***.123.456-** BANCO EXEMPLO AG 0001 CC 12345-6';
	await importFile(page, {
		name: 'extrato.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(`Data;Histórico;Valor\n${d}/${m}/${y};${long};-80,00\n`, 'latin1')
	});
	await page.getByRole('button', { name: 'Review lines (1)' }).click();

	const row = page.getByTestId('import-row');
	await expect(row.getByTestId('import-full-description')).toHaveCount(0);
	const details = row.getByRole('button', { name: 'Details for line 1' });
	await details.click();
	await expect(details).toHaveAttribute('aria-expanded', 'true');
	await expect(row.getByTestId('import-full-description')).toHaveText(long);

	await row.getByLabel('Payee of line 1').fill('Maria');
	await expect(row.getByTestId('import-payee')).toHaveText('Maria');
	await expect(row.getByTestId('import-description')).toHaveText(long);
	await details.click();
	await expect(row.getByTestId('import-full-description')).toHaveCount(0);
});

test('says when a file is not a statement', async ({ page }) => {
	await onboard(page);
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await openChecking(page);
	await page.getByTestId('import-file').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('just some notes')
	});
	await expect(page.getByText("Moneta couldn't read that file.", { exact: false })).toBeVisible();
	await expect(page.getByTestId('register-title')).toHaveText('Checking');
});
