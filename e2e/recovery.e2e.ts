import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { deleteBudget, onboard, openSettings } from './helpers';

/**
 * Overwrites the SQLite header of the budget file in the OPFS pool. It runs on the welcome page,
 * which opens no database, so the pool's handles are free once the app's own tab is closed.
 */
async function damageBudgetFile(context: BrowserContext): Promise<void> {
	const page = await context.newPage();
	await page.goto('/');
	const damaged = await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		const pool = await (await root.getDirectoryHandle('.moneta')).getDirectoryHandle('.opaque');
		const hits: string[] = [];
		for await (const [name, handle] of pool.entries()) {
			if (handle.kind !== 'file') continue;
			const file = await (handle as FileSystemFileHandle).getFile();
			// The pool keeps each file's name in the first 4096 bytes, and the database after them.
			const head = new TextDecoder().decode(await file.slice(0, 4096).arrayBuffer());
			if (!/budget-[0-9a-f-]+\.sqlite3/.test(head)) continue;
			const writable = await (handle as FileSystemFileHandle).createWritable({
				keepExistingData: true
			});
			await writable.write({
				type: 'write',
				position: 4096,
				data: new Uint8Array(4096).fill(0x41)
			});
			await writable.close();
			hits.push(name);
		}
		return hits;
	});
	expect(damaged).toHaveLength(1);
	await page.close();
}

async function backUp(page: Page, path: string): Promise<void> {
	await openSettings(page);
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Back up now' }).click();
	await (await downloading).saveAs(path);
}

test('a damaged budget file leaves a way out: restore a backup', async ({ context }, testInfo) => {
	const first = await context.newPage();
	await onboard(first);
	const backup = testInfo.outputPath('recovery-backup.moneta');
	await backUp(first, backup);
	await first.close();
	await damageBudgetFile(context);

	const page = await context.newPage();
	await page.goto('/budget');
	await expect(page.getByRole('heading', { name: "Your budget couldn't be opened" })).toBeVisible();
	await expect(page.getByTestId('unreadable')).toContainText('not a database');

	await page.reload();
	await expect(page.getByRole('heading', { name: "Your budget couldn't be opened" })).toBeVisible();

	await page.getByLabel('Restore from a backup').setInputFiles(backup);
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');

	// The damaged file is still listed, so it can be deleted from Settings.
	await openSettings(page);
	await expect(page.getByTestId('budget-files').getByRole('listitem')).toHaveCount(2);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('a damaged budget file can be deleted, then a new budget started', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);
	await first.close();
	await damageBudgetFile(context);

	const page = await context.newPage();
	await page.goto('/settings');
	await expect(page.getByRole('heading', { name: "Your budget couldn't be opened" })).toBeVisible();

	await deleteBudget(page, 'Home');
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});
