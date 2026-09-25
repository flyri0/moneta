import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import {
	confirmBackupSaved,
	deleteBudget,
	fillNewBudget,
	nextStep,
	onboard,
	openSettings,
	startApp
} from './helpers';

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
	// A plain download can't tell whether the file was saved: the app asks first.
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: never');
	await confirmBackupSaved(page);
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
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const files = page.getByTestId('budget-files');
	await expect(files.getByRole('listitem')).toHaveText([/Home/, /Changed/]);
	await deleteBudget(page, 'Home');
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

test('encrypts backups once set up, and restores them with the password or the recovery key', async ({
	page,
	browser
}, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const encrypt = page.getByRole('switch', { name: 'Encrypt backups' });
	await expect(encrypt).not.toBeChecked();

	// Setup: a password typed twice, then a recovery key that must be saved first.
	await encrypt.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Password', { exact: true }).fill('short');
	await dialog.getByLabel('Confirm password').fill('short');
	await dialog.getByRole('button', { name: 'Next' }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Use at least 8 characters.');
	// Long enough, but among the first a guesser tries.
	await dialog.getByLabel('Password', { exact: true }).fill('password1');
	await dialog.getByLabel('Confirm password').fill('password1');
	await dialog.getByRole('button', { name: 'Next' }).click();
	await expect(dialog.getByRole('alert')).toContainText('too easy to guess');
	await dialog.getByLabel('Password', { exact: true }).fill('correct horse');
	await dialog.getByLabel('Confirm password').fill('correct horse');
	await dialog.getByRole('button', { name: 'Next' }).click();
	const recoveryKey = (await dialog.getByTestId('recovery-key').textContent())!.trim();
	expect(recoveryKey).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
	await expect(dialog.getByRole('button', { name: 'Turn on' })).toBeDisabled();
	await dialog.getByLabel('I saved my recovery key').click();
	await dialog.getByRole('button', { name: 'Turn on' }).click();
	await expect(dialog).toBeHidden();
	await expect(encrypt).toBeChecked();
	// Exports aren't backups: they stay plain, and the page says so.
	await expect(page.getByText(/exports? (are|is) not encrypted/i)).toBeVisible();

	// The key stays on this device.
	await page.reload();
	await openSettings(page);
	await expect(encrypt).toBeChecked();

	await page.getByRole('button', { name: 'Check password' }).click();
	await dialog.getByLabel('Password').fill('wrong horse');
	await dialog.getByRole('button', { name: 'Check' }).click();
	await expect(dialog.getByRole('status')).toHaveText("That's not the password your backups use.");
	await dialog.getByLabel('Password').fill('correct horse');
	await dialog.getByRole('button', { name: 'Check' }).click();
	await expect(dialog.getByRole('status')).toHaveText("That's the right password.");
	await page.keyboard.press('Escape');

	// Backing up doesn't ask, and the file shows nothing but the encryption settings.
	const backup = testInfo.outputPath('encrypted.moneta');
	await download(page, 'Back up now', backup);
	const bytes = await readFile(backup);
	const zipped = unzipSync(bytes);
	expect(Object.keys(zipped)).toEqual(['moneta.json', 'payload.bin']);
	expect(JSON.parse(strFromU8(zipped['moneta.json']))).toMatchObject({
		format: 'moneta-backup',
		version: 1,
		encryption: { cipher: 'AES-256-GCM', keys: [{ type: 'password' }, { type: 'recovery' }] }
	});
	expect(bytes.toString('latin1')).not.toContain('Home');

	// Restoring asks for the password, even on this device.
	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	await expect(dialog.getByText('This backup is encrypted')).toBeVisible();
	await dialog.getByLabel('Password').fill('wrong horse');
	await dialog.getByRole('button', { name: 'Unlock' }).click();
	await expect(dialog.getByRole('alert')).toHaveText(
		"That doesn't open this backup. Check the password or recovery key."
	);
	await dialog.getByLabel('Password').fill('correct horse');
	await dialog.getByRole('button', { name: 'Unlock' }).click();
	await expect(dialog.getByTestId('restore-budgets').getByRole('listitem')).toHaveText([
		/Home\s*Replaces Home/
	]);
	await page.keyboard.press('Escape');

	// On a new device, the recovery key opens it from onboarding, however it is typed.
	const clean = await browser.newContext();
	const fresh = await clean.newPage();
	await startApp(fresh);
	await nextStep(fresh).click();
	await fresh.getByLabel('Restore from a backup').setInputFiles(backup);
	const unlock = fresh.getByRole('dialog');
	await unlock.getByRole('button', { name: 'Use the recovery key instead' }).click();
	await unlock.getByLabel('Recovery key').fill(recoveryKey.toLowerCase().replaceAll('-', ' '));
	await unlock.getByRole('button', { name: 'Unlock' }).click();
	await expect(fresh.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await clean.close();

	// Turned off, backups are plain again.
	await encrypt.click();
	await expect(encrypt).not.toBeChecked();
	const plain = testInfo.outputPath('plain.moneta');
	await download(page, 'Back up now', plain);
	expect(JSON.parse(strFromU8(unzipSync(await readFile(plain))['moneta.json']))).toMatchObject({
		encryption: null,
		budgets: [{ name: 'Home' }]
	});
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

test('follows a budget restored over the open one, and its renames after', async ({
	page
}, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const backup = testInfo.outputPath('home.moneta');
	await download(page, 'Back up now', backup);
	await page.getByLabel('Budget name').fill('Changed');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const sidebar = page.locator('aside');
	await expect(sidebar).toContainText('Changed');

	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Restore (1)' }).click();
	await dialog.getByRole('button', { name: 'Tap again to restore' }).click({ timeout: 10_000 });
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(sidebar).toContainText('Home');

	await openSettings(page);
	await page.getByLabel('Budget name').fill('Renamed');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(sidebar).toContainText('Renamed');
});

test('records the backup at once when the browser saves it through a file picker', async ({
	page
}) => {
	await onboard(page);
	// A save picker that says where the file went, unlike a download.
	await page.evaluate(() => {
		const written: number[] = [];
		(window as unknown as { written: number[] }).written = written;
		(window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async () => ({
			createWritable: async () => ({
				write: async (data: Blob) => void written.push(data.size),
				close: async () => {}
			})
		});
	});
	await openSettings(page);
	await page.getByRole('button', { name: 'Back up now' }).click();
	await expect(page.getByTestId('last-backup')).not.toHaveText('Last backup: never');
	expect(await page.evaluate(() => (window as unknown as { written: number[] }).written)).toEqual([
		expect.any(Number)
	]);
	await expect(page.getByRole('button', { name: 'It was saved' })).toHaveCount(0);
});
