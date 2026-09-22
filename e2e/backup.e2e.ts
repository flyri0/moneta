import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { onboard, openSettings } from './helpers';

async function download(page: Page, button: string, path: string): Promise<string> {
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: button }).click();
	const file = await downloading;
	await file.saveAs(path);
	return file.suggestedFilename();
}

test('backs up, then restores over the budget or as a new one', async ({ page }, testInfo) => {
	await onboard(page);
	await openSettings(page);
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: never');

	const backup = testInfo.outputPath('home.sqlite');
	expect(await download(page, 'Back up now', backup)).toMatch(
		/^moneta-home-\d{4}-\d{2}-\d{2}\.sqlite$/
	);
	await expect(page.getByTestId('last-backup')).not.toHaveText('Last backup: never');

	await page.getByLabel('Budget name').fill('Changed');
	await page.getByRole('button', { name: 'Save' }).click();
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Changed/]);

	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Replace Changed' }).click();
	await expect(dialog.getByRole('status')).toContainText('replaces everything in Changed');
	await expect(dialog.getByRole('button', { name: /^Replace in \ds$/ })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Tap again to replace' }).click({ timeout: 10_000 });
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Home/]);
	// The replaced budget is kept as a copy of the restored one.
	await expect(page.getByTestId('budget-copies').getByRole('listitem')).toHaveCount(1);

	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	await dialog.getByRole('button', { name: 'Add as a new budget' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Home/]);

	await page.getByLabel('Restore from a backup').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not a budget')
	});
	await dialog.getByRole('button', { name: 'Add as a new budget' }).click();
	await expect(dialog.getByRole('alert')).toHaveText("That file isn't a Moneta backup (.sqlite).");
});

test('exports transactions as CSV and the budget as JSON', async ({ page }, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const csv = testInfo.outputPath('home.csv');
	await download(page, 'Transactions (CSV)', csv);
	expect(await readFile(csv, 'utf8')).toContain(
		',Checking,Starting Balance,,Salary,,1000.00,cleared'
	);
	const json = testInfo.outputPath('home.json');
	await download(page, 'Whole budget (JSON)', json);
	expect(JSON.parse(await readFile(json, 'utf8'))).toMatchObject({
		format: 'moneta-budget',
		meta: { name: 'Home', currency: 'USD' }
	});
});
