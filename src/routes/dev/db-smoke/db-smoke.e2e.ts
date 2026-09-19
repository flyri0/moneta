import { expect, test } from '@playwright/test';

test('persists data in OPFS across reloads', async ({ page }) => {
	const file = `smoke-${Date.now()}.sqlite3`;
	await page.goto(`/dev/db-smoke?file=${file}`);
	await expect(page.getByTestId('status')).toHaveText('ready');
	await expect(page.getByTestId('account')).toHaveCount(0);

	await page.evaluate(async () => {
		const api = (window as unknown as { moneta: import('$lib/db/api').ClientApi }).moneta;
		await api.accounts.create({
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 100000,
			startingDate: '2026-01-01'
		});
	});

	await page.reload();
	await expect(page.getByTestId('status')).toHaveText('ready');
	await expect(page.getByTestId('account')).toHaveText(['Bank']);

	const files = await page.evaluate(async () => {
		const api = (window as unknown as { moneta: import('$lib/db/api').ClientApi }).moneta;
		return api.system.listFiles();
	});
	expect(files).toContain(file);

	const after = await page.evaluate(async (name) => {
		const api = (window as unknown as { moneta: import('$lib/db/api').ClientApi }).moneta;
		await api.system.deleteFile(name);
		return api.system.listFiles();
	}, file);
	expect(after).not.toContain(file);
});
