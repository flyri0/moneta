import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { fillNewBudget, onboard, openSettings } from './helpers';

async function download(page: Page, button: string, path: string): Promise<string> {
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: button }).click();
	const file = await downloading;
	await file.saveAs(path);
	return file.suggestedFilename();
}

test('backs up every budget in one file, then restores some or all of them', async ({
	page
}, testInfo) => {
	await onboard(page);
	await openSettings(page);
	await page.getByRole('button', { name: 'New budget' }).click();
	await fillNewBudget(page, 'Work', '250');
	await expect(page.getByTestId('rta-amount')).toHaveText('$250.00');
	await openSettings(page);
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: never');

	const backup = testInfo.outputPath('backup.moneta');
	expect(await download(page, 'Back up now', backup)).toMatch(
		/^moneta-backup-\d{4}-\d{2}-\d{2}-\d{6}\.moneta$/
	);
	await expect(page.getByTestId('last-backup')).not.toHaveText('Last backup: never');
	// A plain ZIP: the manifest, then one SQLite file per budget.
	const zipped = unzipSync(await readFile(backup));
	expect(Object.keys(zipped)).toEqual([
		'moneta.json',
		expect.stringMatching(/^budgets\/[0-9a-f-]+\.sqlite$/),
		expect.stringMatching(/^budgets\/[0-9a-f-]+\.sqlite$/)
	]);
	expect(JSON.parse(strFromU8(zipped['moneta.json']))).toMatchObject({
		format: 'moneta-backup',
		version: 1,
		encryption: null,
		budgets: [{ name: 'Home' }, { name: 'Work' }]
	});

	// Work is open: rename it, then delete Home.
	await page.getByLabel('Budget name').fill('Changed');
	await page.getByRole('button', { name: 'Save' }).click();
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Changed/]);
	await page.getByRole('button', { name: 'Delete Home' }).click();
	await page.getByRole('button', { name: 'Tap again to delete' }).click();
	await expect(files.getByRole('listitem')).toHaveText([/Changed/]);

	// Restoring only Home brings it back and leaves Changed alone.
	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	const dialog = page.getByRole('dialog');
	const budgets = dialog.getByTestId('restore-budgets');
	await expect(budgets.getByRole('listitem')).toHaveText([/Home\s*New/, /Work\s*Replaces Changed/]);
	await budgets.getByRole('checkbox', { name: 'Work' }).click();
	await dialog.getByRole('button', { name: 'Restore (1)' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Changed/, /Home/]);

	// Restoring Work over Changed asks twice, and keeps Changed as a saved copy of Work.
	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	await expect(budgets.getByRole('listitem')).toHaveText([/Home\s*Replaces Home/, /Work/]);
	await budgets.getByRole('checkbox', { name: 'Home' }).click();
	await dialog.getByRole('button', { name: 'Restore (1)' }).click();
	await expect(dialog.getByRole('status')).toContainText('replaces everything in Changed');
	await expect(dialog.getByRole('button', { name: /^Restore in \ds$/ })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Tap again to restore' }).click({ timeout: 10_000 });
	await expect(page.getByTestId('rta-amount')).toHaveText('$250.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Work/, /Home/]);
	await expect(page.getByTestId('budget-copies').getByRole('listitem')).toHaveCount(1);

	// A backup from before .moneta is a single .sqlite file, always added as a new budget.
	const legacy = testInfo.outputPath('home.sqlite');
	await writeFile(legacy, zipped[Object.keys(zipped)[1]]);
	await page.getByLabel('Restore from a backup').setInputFiles(legacy);
	await expect(budgets.getByRole('listitem')).toHaveText([/Home\s*New/]);
	await dialog.getByRole('button', { name: 'Restore (1)' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await openSettings(page);
	await expect(files.getByRole('listitem')).toHaveText([/Work/, /Home/, /Home/]);

	await page.getByLabel('Restore from a backup').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not a budget')
	});
	await expect(dialog.getByRole('alert')).toHaveText(
		"That file isn't a Moneta backup (.moneta or .sqlite)."
	);
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
