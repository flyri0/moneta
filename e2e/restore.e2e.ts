import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import sqlite3InitModule, { type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import { onboard, openSettings } from './helpers';

let sqlite: Promise<Sqlite3Static> | undefined;

/** Runs `sql` on each budget of a `.moneta` backup, as someone editing the file would. */
async function editBackup(bytes: Uint8Array, sql: string): Promise<Uint8Array> {
	const sqlite3 = await (sqlite ??= sqlite3InitModule());
	const files = unzipSync(bytes);
	for (const [path, image] of Object.entries(files)) {
		if (!path.endsWith('.sqlite')) continue;
		const db = new sqlite3.oo1.DB(':memory:', 'c');
		const copy = image.slice();
		const { capi, wasm } = sqlite3;
		capi.sqlite3_deserialize(
			db,
			'main',
			wasm.allocFromTypedArray(copy),
			copy.length,
			copy.length,
			capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE
		);
		db.exec(sql);
		files[path] = capi.sqlite3_js_db_export(db);
		db.close();
	}
	// The manifest stays first, as the app writes it.
	const { 'moneta.json': manifest, ...rest } = files;
	return zipSync({ 'moneta.json': manifest, ...rest });
}

async function backUp(page: Page, path: string): Promise<Uint8Array> {
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Back up now' }).click();
	await (await downloading).saveAs(path);
	return new Uint8Array(await readFile(path));
}

/** Restores `path` over the budget it holds, answering the replace confirmation. */
async function restoreOver(page: Page, path: string): Promise<void> {
	await page.getByLabel('Restore from a backup').setInputFiles(path);
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Restore (1)' }).click();
	await dialog.getByRole('button', { name: 'Tap again to restore' }).click({ timeout: 10_000 });
	await expect(dialog).toBeHidden();
}

/**
 * The size of the OPFS file that holds the budget file named like `pattern` (the SAH pool keeps
 * each file under an opaque name, with its path at the start of a 4 KiB header), or null.
 */
function opfsFileSize(page: Page, pattern: string): Promise<number | null> {
	return page.evaluate(async (source) => {
		const wanted = new RegExp(source);
		async function find(dir: FileSystemDirectoryHandle): Promise<number | null> {
			const entries = (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
			for await (const handle of entries) {
				if (handle.kind === 'directory') {
					const size = await find(handle as FileSystemDirectoryHandle);
					if (size !== null) return size;
					continue;
				}
				const file = await (handle as FileSystemFileHandle).getFile();
				const path = (await file.slice(0, 512).text()).split('\0')[0];
				if (wanted.test(path)) return file.size;
			}
			return null;
		}
		return find(await navigator.storage.getDirectory());
	}, pattern);
}

test('refuses a backup whose budget breaks the app rules, and stays on the open budget', async ({
	page
}, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const bytes = await backUp(page, testInfo.outputPath('home.moneta'));
	const edited = testInfo.outputPath('edited.moneta');
	await writeFile(
		edited,
		await editBackup(bytes, "UPDATE meta SET value = 'ZZZ' WHERE key = 'currency'")
	);

	await page.getByLabel('Restore from a backup').setInputFiles(edited);
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('alert')).toContainText('damaged');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('budget-files').getByRole('listitem')).toHaveText([/Home/]);
	await expect(page.locator('aside')).toContainText('Home');
});

test('restores a small budget over a big one, leaving nothing of the big one behind', async ({
	page
}, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const small = testInfo.outputPath('small.moneta');
	const bytes = await backUp(page, small);
	const big = testInfo.outputPath('big.moneta');
	await writeFile(
		big,
		await editBackup(
			bytes,
			`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20000)
			 INSERT INTO transactions (id, account_id, date, amount, memo)
			 SELECT 'bulk-' || i, (SELECT id FROM accounts LIMIT 1), '2026-01-02', -1, hex(randomblob(100))
			 FROM n`
		)
	);

	await restoreOver(page, big);
	// 20,000 uncategorized cents out of Checking.
	await expect(page.locator('aside')).toContainText('$800.00');
	await openSettings(page);
	const budgetFile = '^/budget-[0-9a-f-]+\\.sqlite3$';
	const bigSize = await opfsFileSize(page, budgetFile);
	expect(bigSize).toBeGreaterThan(2_000_000);

	await restoreOver(page, small);
	await expect(page.locator('aside')).toContainText('$1,000.00');
	await expect(page.locator('aside')).not.toContainText('$800.00');
	await openSettings(page);
	// The file holds the small budget only: nothing of the big one is left past its end.
	const smallSize = await opfsFileSize(page, budgetFile);
	testInfo.annotations.push({ type: 'opfs', description: `${bigSize} → ${smallSize}` });
	expect(smallSize).toBeLessThan(500_000);

	// A new backup of it reads as a sound database (unreadable ones are skipped with a warning).
	const again = await backUp(page, testInfo.outputPath('again.moneta'));
	const manifest = JSON.parse(strFromU8(unzipSync(again)['moneta.json']));
	expect(manifest.budgets).toHaveLength(1);
});
