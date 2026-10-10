import { expect, test } from '@playwright/test';
import {
	categoryRow,
	chooseCombobox,
	chooseSelect,
	failReadingFiles,
	nextStep,
	onboard,
	openSettings,
	skipIntro,
	startApp,
	UNREADABLE_FILE,
	skipTour
} from './helpers';

test('onboarding creates a budget that survives a reload', async ({ page }) => {
	await onboard(page);
	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('category-row').filter({ hasText: 'Groceries' })).toBeVisible();
});

test('onboarding refuses a blank budget name on its step', async ({ page }) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('   ');
	await nextStep(page).click();
	await expect(page.getByRole('alert')).toHaveText('Enter a name for the budget.');
	await expect(page.getByLabel('Budget name')).toBeFocused();
});

test('onboarding marks a blank budget name without raising the keyboard on phones', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('   ');
	await nextStep(page).click();
	await expect(page.getByRole('alert')).toHaveText('Enter a name for the budget.');
	await expect(page.getByLabel('Budget name')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByLabel('Budget name')).not.toBeFocused();
});

test('onboarding keeps the account typed when going back, and flags a repeated category', async ({
	page
}) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await nextStep(page).click();
	const add = page.getByLabel('Add a category — Everyday');
	await add.fill('groceries');
	await add.press('Enter');
	await expect(page.getByRole('alert')).toHaveText('Already in this group.');
	await nextStep(page).click();
	await page.getByRole('button', { name: 'Checking' }).click();
	await page.getByLabel('Current balance').fill('250');
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(page.getByText('Your categories')).toBeVisible();
	await nextStep(page).click();
	await expect(page.getByLabel('Current balance')).toHaveValue('250');
});

test('onboarding seeds only the categories that were picked', async ({ page }) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();

	await page.getByRole('checkbox', { name: 'Fun', exact: true }).click();
	await page.getByLabel('Add a category — Goals').fill('New bike');
	await page.getByLabel('Add a category — Goals').press('Enter');
	await nextStep(page).click();

	await page.getByRole('button', { name: 'Checking' }).click();
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill('1000');
	await page.getByRole('button', { name: 'Create budget' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await skipTour(page);

	await expect(categoryRow(page, 'Groceries')).toBeVisible();
	await expect(categoryRow(page, 'New bike')).toBeVisible();
	await expect(categoryRow(page, 'Entertainment')).toHaveCount(0);
	await expect(categoryRow(page, 'Hobbies')).toHaveCount(0);
});

test('onboarding can start with no categories, keeping an empty Income group', async ({ page }) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();

	await expect(page.getByRole('checkbox', { name: 'Salary', exact: true })).toBeChecked();
	await page.getByRole('button', { name: 'Start with no categories' }).click();
	await expect(page.getByText('0 selected')).toBeVisible();
	await nextStep(page).click();

	await page.getByRole('button', { name: 'Start with no account' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await skipTour(page);

	await expect(page.getByTestId('rta-amount')).toHaveText('$0.00');
	await expect(page.getByTestId('category-row')).toHaveCount(0);
	// The grid leaves an empty Income group out; the order editor shows it's there.
	await page.getByRole('button', { name: 'Edit order' }).click();
	const sections = page.locator('[data-order-group]');
	await expect(sections).toHaveCount(1);
	await expect(sections).toHaveAttribute('aria-label', 'Income');
	await expect(sections.getByTestId('order-category')).toHaveCount(0);
});

test('onboarding can start with no account', async ({ page }) => {
	await startApp(page);
	await skipIntro(page);
	await page.getByLabel('Budget name').fill('Home');
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();
	await nextStep(page).click();

	await page.getByRole('button', { name: 'Start with no account' }).click();
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await skipTour(page);

	await expect(page.getByTestId('rta-amount')).toHaveText('$0.00');
	await page.getByRole('link', { name: 'Accounts' }).first().click();
	await expect(page.getByText('No accounts yet')).toBeVisible();
});

test('a second tab waits until it takes over', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);

	const second = await context.newPage();
	await second.goto('/');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await second.getByRole('button', { name: 'Use Moneta here' }).click();
	await expect(second.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(first.getByText('Moneta is open in another tab')).toBeVisible();
});

test('a waiting tab opens by itself once the other tab closes', async ({ context }) => {
	const first = await context.newPage();
	await onboard(first);
	const second = await context.newPage();
	await second.goto('/budget');
	await expect(second.getByText('Moneta is open in another tab')).toBeVisible();
	await first.close();
	await expect(second.getByTestId('rta-amount')).toHaveText('$1,000.00');
});

test('a worker waits for one still holding the storage, and never tries to delete it', async ({
	context
}) => {
	const first = await context.newPage();
	await onboard(first);
	const workerUrl = await first.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((e) => e.name)
			.find((n) => /\/workers\/worker-.*\.js$/.test(n))!
	);

	// A worker the tab lock knows nothing about, as from a tab whose page let go before its worker.
	await context.route('**/blank.html', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' })
	);
	const other = await context.newPage();
	const errors: string[] = [];
	other.on('worker', (w) => w.on('console', (m) => m.type() === 'error' && errors.push(m.text())));
	await other.goto('/blank.html');
	await other.evaluate((url) => {
		const worker = new Worker(url, { type: 'module' });
		const w = window as unknown as { reply?: unknown };
		worker.onmessage = (event) => (w.reply = event.data);
		worker.postMessage({ id: 1, method: 'system.listFiles', args: [] });
	}, workerUrl);

	// It asked for the pool's lock and is still waiting for it.
	await expect
		.poll(() =>
			other.evaluate(async () =>
				((await navigator.locks.query()).pending ?? []).some((l) => l.name === 'moneta-opfs')
			)
		)
		.toBe(true);
	expect(
		await other.evaluate(() => (window as unknown as { reply?: unknown }).reply)
	).toBeUndefined();
	await first.close();
	await expect
		.poll(() => other.evaluate(() => (window as unknown as { reply?: unknown }).reply))
		.toMatchObject({ id: 1, ok: true });
	expect(errors).toEqual([]);
});

test('a tab whose storage stays taken says so and opens once it is let go', async ({ context }) => {
	test.setTimeout(60_000);
	await context.route('**/blank.html', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' })
	);
	const holder = await context.newPage();
	await holder.goto('/blank.html');
	await holder.evaluate(() => {
		const w = window as unknown as { letGo?: () => void };
		void navigator.locks.request(
			'moneta-opfs',
			() => new Promise<void>((resolve) => (w.letGo = resolve))
		);
	});

	const page = await context.newPage();
	await startApp(page);
	await expect(page.getByText('Moneta is still closing in another tab')).toBeVisible({
		timeout: 20_000
	});
	await holder.evaluate(() => (window as unknown as { letGo: () => void }).letGo());
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
});

test('onboarding allows choosing theme, accent, and language on the welcome step', async ({
	page
}) => {
	await startApp(page);
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();

	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'teal');

	await page.getByRole('button', { name: 'Violet' }).click();
	await page.getByRole('button', { name: 'Dark' }).click();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);

	await chooseSelect(page, 'Language', 'Português (Brasil)');
	await expect(page.getByText('Boas-vindas ao Moneta')).toBeVisible();
	await expect(html).toHaveAttribute('data-theme', 'violet');
	await expect(html).toHaveClass(/dark/);

	await page.getByRole('button', { name: 'Avançar' }).click();
	await expect(page.getByText('Um ponto de atenção')).toBeVisible();
	await page.getByRole('button', { name: 'Avançar' }).click();
	await expect(page.getByLabel('Nome do orçamento')).toHaveValue('Meu orçamento');
});

test.describe('onboarding on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('picks an accent colour from a sheet during onboarding', async ({ page }) => {
		await startApp(page);
		await expect(page.getByText('Welcome to Moneta')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Amber' })).toBeHidden();

		await page.getByRole('button', { name: 'Accent color' }).click();
		await page.getByRole('button', { name: 'Amber' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber');
		await expect(page.getByRole('button', { name: 'Accent color' })).toContainText('Amber');
	});
});

test('restores a backup directly from the onboarding backups step', async ({
	context
}, testInfo) => {
	const page1 = await context.newPage();
	await onboard(page1);
	await openSettings(page1);
	const backup = testInfo.outputPath('backups-step-backup.moneta');
	const downloading = page1.waitForEvent('download');
	await page1.getByRole('button', { name: 'Back up now' }).click();
	const file = await downloading;
	await file.saveAs(backup);
	await page1.close();

	const cleanContext = await context.browser()!.newContext();
	const page2 = await cleanContext.newPage();
	await startApp(page2);
	await expect(page2.getByText('Welcome to Moneta')).toBeVisible();

	// Advance to Step 2 (Backups warning)
	await nextStep(page2).click();
	await expect(page2.getByText('One thing to know')).toBeVisible();
	await expect(page2.getByText('Already have a backup?')).toBeVisible();

	// Pick invalid file first to test inline error display on Step 2
	await page2.getByLabel('Restore from a backup').setInputFiles({
		name: 'invalid.sqlite',
		mimeType: 'application/vnd.sqlite3',
		buffer: Buffer.from('not a sqlite database')
	});
	await expect(page2.getByRole('alert')).toHaveText(
		"That file isn't a Moneta backup (.moneta or .sqlite)."
	);

	// Pick valid backup to restore
	await page2.getByLabel('Restore from a backup').setInputFiles(backup);
	await expect(page2.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(categoryRow(page2, 'Groceries')).toBeVisible();
	await cleanContext.close();
});

test('a backup file that cannot be read shows an error and leaves onboarding usable', async ({
	page
}) => {
	await failReadingFiles(page);
	await startApp(page);
	await nextStep(page).click();
	await expect(page.getByText('Already have a backup?')).toBeVisible();
	await page.getByLabel('Restore from a backup').setInputFiles(UNREADABLE_FILE);
	await expect(page.getByTestId('form-message')).toBeVisible();
	await expect(nextStep(page)).toBeEnabled();
});
