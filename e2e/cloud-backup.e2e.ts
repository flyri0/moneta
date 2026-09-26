import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { fakeDrive } from '../src/features/backup/cloud/fake-drive';
import { nextStep, onboard, openSettings, spend, startApp } from './helpers';

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

/**
 * Answers Google in this context with a fake Drive: the sign-in page sends the popup straight
 * back to the callback with a code, and the token proxy and Drive's API answer from memory.
 */
async function routeGoogle(context: BrowserContext, drive = fakeDrive()) {
	await context.route('https://accounts.google.com/**', (route) => {
		const asked = new URL(route.request().url());
		const back = new URL(asked.searchParams.get('redirect_uri')!);
		back.searchParams.set('code', 'e2e-code');
		back.searchParams.set('state', asked.searchParams.get('state')!);
		return route.fulfill({ status: 302, headers: { location: back.toString() } });
	});
	const answer = async (route: Route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		const res = await drive.fetcher(request.url(), {
			method: request.method(),
			headers: await request.allHeaders(),
			body: request.postDataBuffer() ?? undefined
		});
		return route.fulfill({
			status: res.status,
			headers: { ...CORS, 'content-type': res.headers.get('content-type') ?? 'text/plain' },
			body: Buffer.from(await res.arrayBuffer())
		});
	};
	await context.route('https://www.googleapis.com/**', answer);
	await context.route('https://oauth2.googleapis.com/**', answer);
	await context.route('**/api/oauth/**', answer);
	return drive;
}

async function turnOnEncryption(page: Page): Promise<void> {
	await page.getByRole('switch', { name: 'Encrypt backups' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Password', { exact: true }).fill('correct horse');
	await dialog.getByLabel('Confirm password').fill('correct horse');
	await dialog.getByRole('button', { name: 'Next' }).click();
	await dialog.getByLabel('I saved my recovery key').click();
	await dialog.getByRole('button', { name: 'Turn on' }).click();
	await expect(dialog).toBeHidden();
}

/** Clicks what opens the sign-in popup, and waits for the popup to answer and close. */
async function signIn(page: Page, opener: { click(): Promise<void> }): Promise<void> {
	const popup = page.waitForEvent('popup');
	await opener.click();
	const opened = await popup;
	await expect.poll(() => opened.isClosed()).toBe(true);
}

/** Hides the page, as switching away does: a waiting change is backed up at once. */
async function hidePage(page: Page): Promise<void> {
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
	});
}

test('backs up to Google Drive by itself once connected, encrypted', async ({ page, context }) => {
	const drive = await routeGoogle(context);
	const violations: string[] = [];
	page.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) violations.push(message.text());
	});
	await onboard(page);
	await openSettings(page);

	// Encryption comes first: connecting without it opens the setup.
	const connect = page.getByRole('button', { name: /Connect Google Drive/ });
	await expect(connect).toContainText('Turn on backup encryption first.');
	await connect.click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await turnOnEncryption(page);

	// One sign-in in a popup, then the first backup.
	await signIn(page, connect);
	await expect(page.getByText('me@example.com')).toBeVisible();
	await expect(page.getByTestId('cloud-status')).toContainText('Last backup to Google Drive:');
	expect(drive.backups()).toHaveLength(1);
	const [saved] = [...drive.state.files.values()].filter(
		(f) => f.appProperties.moneta === 'backup'
	);
	expect(saved.name).toMatch(/^moneta-backup-\d{4}-\d{2}-\d{2}\.moneta$/);
	expect(saved.parents).toHaveLength(1);

	// A change is backed up without asking, replacing the day's file.
	const size = saved.content.length;
	await page.getByRole('link', { name: 'Budget' }).first().click();
	await spend(page, 'Market', '60', 'Groceries');
	drive.state.calls.length = 0;
	await hidePage(page);
	await expect.poll(() => drive.state.calls).toContain('PATCH /upload/drive/v3/files/' + saved.id);
	expect(drive.backups()).toHaveLength(1);
	expect(saved.content.length).not.toBe(size);

	// Access revoked in Google: backups stop, say so, and a new sign-in resumes them.
	drive.state.validToken = 'revoked';
	drive.state.refresh = { status: 400, error: 'invalid_grant' };
	await openSettings(page);
	await page.getByRole('button', { name: 'Back up to Google Drive now' }).click();
	const alert = page.getByTestId('cloud-error');
	await expect(alert).toContainText('Moneta lost access to your cloud storage.');
	drive.state.refresh = { status: 200, error: '' };
	drive.state.validToken = 'access-9';
	await signIn(page, alert.getByRole('button', { name: 'Connect again' }));
	await expect(alert).toBeHidden();
	expect(violations).toEqual([]);
});

test('restores a backup from Google Drive on a new device', async ({ browser }) => {
	const drive = fakeDrive();
	const first = await browser.newContext();
	await routeGoogle(first, drive);
	const page = await first.newPage();
	await onboard(page, 'Trip');
	await openSettings(page);
	await turnOnEncryption(page);
	await signIn(page, page.getByRole('button', { name: /Connect Google Drive/ }));
	await expect(page.getByTestId('cloud-status')).toContainText('Last backup to Google Drive:');
	await first.close();

	// Another browser: restore it during onboarding, with the password.
	const second = await browser.newContext();
	await routeGoogle(second, drive);
	const fresh = await second.newPage();
	await startApp(fresh);
	await expect(fresh.getByText('Welcome to Moneta')).toBeVisible();
	await nextStep(fresh).click();
	await fresh.getByRole('button', { name: 'Restore from Google Drive' }).click();
	const dialog = fresh.getByRole('dialog');
	await signIn(fresh, dialog.getByRole('button', { name: 'Connect Google Drive' }));
	const backups = dialog.getByTestId('cloud-backups');
	await expect(backups.getByRole('button')).toHaveCount(1);
	await backups.getByRole('button').click();
	const unlock = fresh.getByRole('dialog');
	await unlock.getByLabel('Password', { exact: true }).fill('correct horse');
	await unlock.getByRole('button', { name: 'Unlock' }).click();
	await expect(fresh.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await second.close();
});
