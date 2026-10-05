import { expect, test, type Locator, type Page } from '@playwright/test';
import { fillNewBudget, nextStep, onboard, openSettings, skipIntro, startApp } from './helpers';

/** Onboarding's first budget, up to where the tour opens over it. */
async function firstBudget(page: Page): Promise<void> {
	await startApp(page);
	await skipIntro(page);
	await fillNewBudget(page, 'Home', '1000');
	await page.getByRole('button', { name: 'Start budgeting' }).click();
}

function card(page: Page): Locator {
	return page.getByTestId('tour-card');
}

/** Moves on, with the card's button named for where the tour is. */
async function next(page: Page): Promise<void> {
	await card(page)
		.getByRole('button', { name: /^(Start tour|Next)$/ })
		.click();
}

async function tourState(page: Page): Promise<string | null> {
	return page.evaluate(() => localStorage.getItem('moneta.tour'));
}

/** Waits for the spotlight to settle around `target`. */
async function expectLit(page: Page, target: Locator): Promise<void> {
	const spotlight = page.getByTestId('tour-spotlight');
	await expect
		.poll(async () => {
			const [lit, box] = [await spotlight.boundingBox(), await target.boundingBox()];
			if (!lit || !box) return false;
			return (
				lit.x <= box.x &&
				lit.y <= box.y &&
				lit.x + lit.width >= box.x + box.width &&
				lit.y + lit.height >= box.y + box.height
			);
		})
		.toBe(true);
}

/** Checks the card sits fully inside the window. */
async function expectCardInView(page: Page): Promise<void> {
	const viewport = page.viewportSize()!;
	await expect
		.poll(async () => {
			const box = await card(page).boundingBox();
			if (!box) return false;
			return (
				box.x >= 0 &&
				box.y >= 0 &&
				box.x + box.width <= viewport.width &&
				box.y + box.height <= viewport.height
			);
		})
		.toBe(true);
}

test('walks through the basics once, on the first budget', async ({ page }) => {
	await firstBudget(page);

	await expect(card(page)).toContainText('Welcome to your budget');
	await card(page).getByRole('button', { name: 'Start tour' }).click();

	await expect(card(page)).toContainText('1 of 12');
	await expect(card(page).getByRole('heading')).toHaveText('Ready to Assign');
	await expect(card(page).getByRole('link', { name: 'Learn more in the guide' })).toHaveAttribute(
		'href',
		'/guide/budgeting/#ready-to-assign'
	);
	await expectLit(page, page.getByTestId('rta-card'));

	await card(page).getByRole('button', { name: 'Next' }).click();
	await expect(card(page).getByRole('heading')).toHaveText('Your categories');
	await expect(card(page)).toContainText('Type an amount in Assigned');
	await card(page).getByRole('button', { name: 'Back' }).click();
	await expect(card(page).getByRole('heading')).toHaveText('Ready to Assign');
	await page.keyboard.press('ArrowRight');
	await expect(card(page).getByRole('heading')).toHaveText('Your categories');

	await card(page).getByRole('button', { name: 'Next' }).click();
	await expect(card(page).getByRole('heading')).toHaveText('Record transactions');
	await expectLit(page, page.locator('#sidebar [data-tour="add-transaction"]'));
	await next(page);
	await expect(card(page).getByRole('heading')).toHaveText('Month by month');
	await expectLit(page, page.locator('[data-tour="month"]'));
	await expectCardInView(page);
	await next(page);
	await expect(card(page).getByRole('heading')).toHaveText('Accounts');

	// Each screen around the budget: the way in first, then the screen itself.
	await next(page);
	await expect(card(page).getByRole('heading')).toHaveText('Bills that repeat');
	await expectLit(page, page.locator('#sidebar [data-tour="schedules"]'));
	await next(page);
	await expect(page).toHaveURL(/\/transactions\/scheduled$/);
	await expect(card(page).getByRole('heading')).toHaveText('Schedules');
	await expect(card(page)).toContainText("even ones you're already paying");
	await expectLit(page, page.getByRole('link', { name: 'Scheduled', exact: true }));

	// Back across screens returns to the budget, and Next opens Schedules again.
	await card(page).getByRole('button', { name: 'Back' }).click();
	await expect(page).toHaveURL(/\/budget\//);
	await expect(card(page).getByRole('heading')).toHaveText('Bills that repeat');
	await next(page);
	await expect(page).toHaveURL(/\/transactions\/scheduled$/);

	await next(page);
	await expect(card(page).getByRole('heading')).toHaveText('Where your money goes');
	await expectLit(page, page.locator('#sidebar [data-tour="reports"]'));
	await next(page);
	await expect(page).toHaveURL(/\/reports$/);
	await expect(card(page).getByRole('heading')).toHaveText('Reports');
	await expect(card(page)).toContainText('Like this one');
	await expectLit(page, page.getByTestId('report-cards').locator('[data-tour="report-card"]'));

	await next(page);
	await expect(card(page).getByRole('heading')).toHaveText('Settings');
	await expectLit(page, page.locator('#sidebar [data-tour="settings"]'));
	await next(page);
	await expect(page).toHaveURL(/\/settings$/);
	await expect(card(page).getByRole('heading')).toHaveText('Backups');
	await expect(card(page)).toContainText('Google Drive');
	await expectLit(page, page.getByTestId('backup-card'));
	await expectCardInView(page);

	await next(page);
	await expect(card(page).getByRole('heading')).toHaveText("You're ready");
	await expectLit(page, page.locator('[data-tour="about"]'));
	await expect(card(page).getByRole('link', { name: 'Open the guide' })).toHaveAttribute(
		'href',
		'/guide/'
	);

	await card(page).getByRole('button', { name: 'Done' }).click();
	await expect(page.getByTestId('tour')).toBeHidden();
	expect(await tourState(page)).toBe('done');

	await expect(page).toHaveURL(/\/settings$/);

	await page.goto('/budget');
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('tour')).toBeHidden();
});

test('fits a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await firstBudget(page);

	await card(page).getByRole('button', { name: 'Start tour' }).click();
	await expectCardInView(page);
	await card(page).getByRole('button', { name: 'Next' }).click();
	await expect(card(page)).toContainText('Tap a category');
	// The first category that takes money, not an income one.
	await expectLit(page, page.locator('[data-tour="category"]').first());
	await expectCardInView(page);

	await card(page).getByRole('button', { name: 'Next' }).click();
	await expectLit(page, page.locator('button[data-tour="add-transaction"]:visible'));
	await expectCardInView(page);

	await next(page);
	await expectLit(page, page.locator('[data-tour="month"]'));
	await expectCardInView(page);

	await next(page);
	const bar = page.getByRole('navigation').last();
	await expectLit(page, bar.getByRole('link', { name: 'Accounts' }));
	await expectCardInView(page);

	await next(page);
	await expect(card(page)).toContainText('in the Scheduled tab');
	await expectLit(page, bar.getByRole('link', { name: 'Transactions' }));
	await expectCardInView(page);

	await next(page);
	await expect(page).toHaveURL(/\/transactions\/scheduled$/);
	await expectLit(page, page.getByRole('link', { name: 'Scheduled', exact: true }));
	await expectCardInView(page);

	await next(page);
	await expectLit(page, bar.getByRole('link', { name: 'Reports' }));
	await next(page);
	await expect(page).toHaveURL(/\/reports$/);
	await expectCardInView(page);

	await next(page);
	await expectLit(page, bar.getByRole('link', { name: 'Settings' }));
	await next(page);
	await expect(page).toHaveURL(/\/settings$/);
	await expectLit(page, page.getByTestId('backup-card'));
	await expectCardInView(page);
});

test('keeps the page still under it on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 500 });
	// The tour's own scroll to each step is then instant, so it's over before the page is measured.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await firstBudget(page);
	await next(page);
	await next(page);
	const spotlight = page.getByTestId('tour-spotlight');
	await expectLit(page, page.locator('[data-tour="category"]').first());
	const [scrolled, lit] = [
		await page.evaluate(() => window.scrollY),
		await spotlight.boundingBox()
	];

	// A swipe or the wheel over the dimmed page would scroll it, and on a phone hide the toolbar.
	await page.mouse.move(200, 250);
	await page.mouse.wheel(0, 600);
	const touch = await page.context().newCDPSession(page);
	const point = (y: number) => [{ x: 200, y }];
	await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(400) });
	for (const y of [350, 300, 250, 200, 150]) {
		await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(y) });
	}
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

	expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
	expect(await spotlight.boundingBox()).toEqual(lit);
	await expectCardInView(page);

	await page.keyboard.press('Escape');
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
		'visible'
	);
});

test("follows the browser's back button", async ({ page }) => {
	await firstBudget(page);
	await next(page);
	for (let i = 0; i < 6; i++) await next(page);
	await expect(page).toHaveURL(/\/transactions\/scheduled$/);
	await page.goBack();
	await expect(card(page).getByRole('heading')).toHaveText('Bills that repeat');
	await page.goForward();
	await expect(card(page).getByRole('heading')).toHaveText('Schedules');
});

test('skipping ends it for good', async ({ page }) => {
	await firstBudget(page);
	await card(page).getByRole('button', { name: 'Start tour' }).click();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('tour')).toBeHidden();

	await page.reload();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(page.getByTestId('tour')).toBeHidden();
	expect(await tourState(page)).toBe('done');
});

test('leaves a second budget alone, and comes back from Settings', async ({ page }) => {
	await onboard(page);
	await openSettings(page);
	await page.getByRole('button', { name: 'New budget' }).click();
	await fillNewBudget(page, 'Work', '250');
	await expect(page.getByTestId('rta-amount')).toHaveText('$250.00');
	await expect(page.getByTestId('tour')).toBeHidden();

	await openSettings(page);
	await page.getByRole('button', { name: 'Take the tour' }).click();
	await expect(card(page)).toContainText('Welcome to your budget');
	await card(page).getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByTestId('tour')).toBeHidden();
});

test('leaves a restored backup alone', async ({ page, browser }, testInfo) => {
	await onboard(page);
	await openSettings(page);
	const backup = testInfo.outputPath('backup.moneta');
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Back up now' }).click();
	await (await downloading).saveAs(backup);

	const clean = await browser.newContext();
	const fresh = await clean.newPage();
	await startApp(fresh);
	await nextStep(fresh).click();
	await fresh.getByLabel('Restore from a backup').setInputFiles(backup);
	await expect(fresh.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await expect(fresh.getByTestId('tour')).toBeHidden();
	expect(await tourState(fresh)).toBe('done');
	await clean.close();
});

test('leaves the demo alone', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Try the demo' }).click();
	await expect(page.getByTestId('rta-amount')).toBeVisible();
	await expect(page.getByTestId('tour')).toBeHidden();
	expect(await tourState(page)).toBeNull();
});
