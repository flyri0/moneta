import { expect, type Locator, type Page } from '@playwright/test';

export function nextStep(page: Page) {
	return page.getByRole('button', { name: 'Next' });
}

/** Selects an option from a shadcn Select dropdown. */
export async function chooseSelect(
	container: Page | Locator,
	label: string | RegExp,
	optionText: string | RegExp
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	const trigger = container.getByLabel(label, { exact: false });
	await trigger.click();
	const content = page.locator('[data-slot="select-content"][data-state="open"]');
	await content
		.locator('[data-slot="select-item"]')
		.filter({ hasText: optionText })
		.first()
		.click();
	await expect(content).toBeHidden();
}

/** Selects an option from a shadcn Combobox. */
export async function chooseCombobox(
	container: Page | Locator,
	label: string | RegExp,
	itemText: string | RegExp,
	search?: string
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	const trigger = container.getByLabel(label, { exact: false });
	await trigger.click();
	const popover = page.locator('[data-picker][data-state="open"]');
	if (search) {
		await popover.locator('[data-slot="command-input"]').fill(search);
	}
	await popover.locator('[data-slot="command-item"]').filter({ hasText: itemText }).first().click();
	await expect(popover).toBeHidden();
}

/** Picks a date using the custom DatePicker. */
export async function pickDate(
	container: Page | Locator,
	label: string | RegExp,
	dateStr: string // 'YYYY-MM-DD'
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	const trigger = container.getByLabel(label, { exact: false });
	await trigger.click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	const [y, m, d] = dateStr.split('-').map(Number);
	// Click Year select if needed
	const yearSelect = popover.getByLabel('Year');
	if (await yearSelect.isVisible()) {
		await yearSelect.click();
		await page
			.locator('[data-slot="select-content"][data-state="open"]')
			.locator('[data-slot="select-item"]')
			.filter({ hasText: String(y) })
			.first()
			.click();
	}
	// Click Month select if needed
	const monthSelect = popover.getByLabel('Month');
	if (await monthSelect.isVisible()) {
		await monthSelect.click();
		await page
			.locator('[data-slot="select-content"][data-state="open"]')
			.locator('[data-slot="select-item"]')
			.nth(m - 1)
			.click();
	}
	// Click the day in this month: the grid also shows the neighbours' days (Aug 30 before Sep 1).
	await popover
		.locator('[data-slot="calendar-day"]:not([data-outside-month])')
		.filter({ hasText: new RegExp(`^${d}$`) })
		.first()
		.click();
	await expect(popover).toBeHidden();
}

/**
 * Walks the budget, categories and account steps (USD, en-US, the starter categories, a checking
 * account) and creates the budget. Expects the budget step to be showing.
 */
export async function fillNewBudget(page: Page, name: string, balance: string): Promise<void> {
	await page.getByLabel('Budget name').fill(name);
	await chooseCombobox(page, 'Number and date format', 'en-US', 'en-US');
	await chooseCombobox(page, 'Currency', 'USD', 'USD');
	await nextStep(page).click();
	await nextStep(page).click();
	await page.getByRole('button', { name: 'Checking' }).click();
	await page.getByLabel('Account name').fill('Checking');
	await page.getByLabel('Current balance').fill(balance);
	await page.getByRole('button', { name: 'Create budget' }).click();
}

/** Chooses the browser on the welcome page and gets past the warning about it. */
export async function useInBrowser(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Use it in the browser' }).click();
	await page.getByRole('button', { name: 'Continue in the browser' }).click();
}

/**
 * Makes backups and exports plain downloads, as in browsers without a save picker: Chromium's
 * picker is a native dialog that tests can't answer.
 */
export async function useDownloads(page: Page): Promise<void> {
	await page.addInitScript(() => {
		delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
	});
}

/** Answers "Did the backup file download?" after a backup made as a plain download. */
export async function confirmBackupSaved(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'It was saved' }).click();
}

/** Opens Moneta and leaves the welcome page for the app itself. */
export async function startApp(page: Page): Promise<void> {
	await useDownloads(page);
	await page.goto('/');
	await useInBrowser(page);
}

/** Skips the two steps that explain the app, leaving onboarding on the budget step. */
export async function skipIntro(page: Page): Promise<void> {
	await expect(page.getByText('Welcome to Moneta')).toBeVisible();
	await nextStep(page).click();
	await nextStep(page).click();
}

/** What a finished onboarding leaves in the browser: the OPFS files and `localStorage`. */
interface DeviceState {
	/** Each file's contents as a `data:` URL: far quicker to pass to the page than an array. */
	files: { path: string; data: string }[];
	storage: Record<string, string>;
}

/**
 * Onboarded devices by budget name and the page's date (a test may fix the clock), taken once per
 * worker process. Each test still gets its own copy, in its own browser context.
 */
const onboarded = new Map<string, DeviceState>();

/**
 * Creates a USD budget with a checking account holding $1,000 and lands on the budget screen.
 * The first call for a name and date in a worker goes through onboarding; later ones copy what it
 * left, which takes a second instead of four.
 */
export async function onboard(page: Page, name = 'Home'): Promise<void> {
	await useDownloads(page);
	// A static file of the origin, served with its type by `pnpm preview` and pwa.e2e.ts's server:
	// the app doesn't start there, so nothing holds the files yet.
	await page.goto('/icon.svg');
	const { today, storage } = await page.evaluate(() => {
		let storage = true;
		try {
			void localStorage.length;
		} catch {
			storage = false;
		}
		return { today: new Date().toDateString(), storage };
	});
	// Without localStorage (storage.e2e.ts) there is less to copy: such a test onboards for real.
	const key = storage ? `${name} ${today}` : null;
	const saved = key && onboarded.get(key);
	if (saved) {
		await page.evaluate(writeDeviceState, saved);
		await page.goto('/budget');
		await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
		return;
	}
	await startApp(page);
	await skipIntro(page);
	await fillNewBudget(page, name, '1000');
	await page.getByRole('button', { name: 'Start budgeting' }).click();
	await expect(page.getByTestId('rta-amount')).toHaveText('$1,000.00');
	await skipTour(page);
	if (key) onboarded.set(key, await page.evaluate(readDeviceState));
}

async function readDeviceState(): Promise<DeviceState> {
	const files: DeviceState['files'] = [];
	async function walk(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
		for await (const [name, handle] of dir as unknown as AsyncIterable<
			[string, FileSystemHandle]
		>) {
			if (handle instanceof FileSystemDirectoryHandle) await walk(handle, `${path}${name}/`);
			else {
				const file = await (handle as FileSystemFileHandle).getFile();
				const data = await new Promise<string>((resolve) => {
					const reader = new FileReader();
					reader.onload = () => resolve(reader.result as string);
					reader.readAsDataURL(file);
				});
				files.push({ path: path + name, data });
			}
		}
	}
	await walk(await navigator.storage.getDirectory(), '');
	return { files, storage: { ...localStorage } };
}

async function writeDeviceState({ files, storage }: DeviceState): Promise<void> {
	const root = await navigator.storage.getDirectory();
	for (const { path, data } of files) {
		const parts = path.split('/');
		let dir = root;
		for (const part of parts.slice(0, -1))
			dir = await dir.getDirectoryHandle(part, { create: true });
		const file = await dir.getFileHandle(parts.at(-1)!, { create: true });
		const writable = await file.createWritable();
		await writable.write(await (await fetch(data)).blob());
		await writable.close();
	}
	for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
}

/** Skips the tour that opens over the first budget made on a device. */
export async function skipTour(page: Page): Promise<void> {
	const tour = page.getByTestId('tour');
	await tour.getByRole('button', { name: 'Skip' }).click();
	await expect(tour).toBeHidden();
}

export function categoryRow(page: Page, name: string) {
	return page.getByTestId('category-row').filter({ hasText: name });
}

export async function openSettings(page: Page): Promise<void> {
	await page.getByRole('link', { name: 'Settings' }).first().click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

/** Opens one part of the settings' backup card (`Encryption`, `Exports`…): its row opens a sheet. */
export async function openBackupPart(page: Page, name: string): Promise<Locator> {
	await page
		.getByTestId('backup-card')
		.getByRole('button', { name: new RegExp(`^${name}`) })
		.click();
	const sheet = page.getByRole('dialog', { name });
	await expect(sheet).toBeVisible();
	return sheet;
}

/** Deletes a budget through its confirmation: type the name, tap, wait, tap again. */
export async function deleteBudget(page: Page, name: string): Promise<void> {
	await page.getByRole('button', { name: `Delete ${name}` }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel(`Type ${name} to confirm`).fill(name);
	await dialog.getByRole('button', { name: 'Delete budget' }).click();
	await dialog.getByRole('button', { name: 'Tap again to delete' }).click({ timeout: 10_000 });
}

/** Enters an outflow of `amount` to `payee` in `category` from the transaction dialog. */
export async function spend(page: Page, payee: string, amount: string, category: string) {
	await page.getByRole('button', { name: 'Transaction', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', payee, payee);
	await dialog.getByLabel('Amount', { exact: true }).fill(amount);
	await chooseCombobox(dialog, 'Category', category, category);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

/** Makes reading a picked file named `unreadable.moneta` fail, as a file removed meanwhile does. */
export async function failReadingFiles(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const read = Blob.prototype.arrayBuffer;
		File.prototype.arrayBuffer = function (this: File) {
			return this.name === 'unreadable.moneta'
				? Promise.reject(new DOMException('The file could not be read.', 'NotReadableError'))
				: read.call(this);
		};
	});
}

/** A backup file whose reading fails once `failReadingFiles` ran. */
export const UNREADABLE_FILE = {
	name: 'unreadable.moneta',
	mimeType: 'application/octet-stream',
	buffer: Buffer.from('x')
};

/** Picks a range in the DateRangePicker: the month and year of its start, then both days. */
export async function pickDateRange(
	container: Page | Locator,
	label: string | RegExp,
	from: string, // 'YYYY-MM-DD'
	to: string
): Promise<void> {
	const page = 'page' in container ? (container as Locator).page() : (container as Page);
	await container.getByLabel(label, { exact: false }).click();
	const popover = page.locator('[data-slot="popover-content"][data-state="open"]');
	const [y, m] = from.split('-').map(Number);
	await popover.getByLabel(/^(Year|Ano)$/).click();
	await page
		.locator('[data-slot="select-content"][data-state="open"] [data-slot="select-item"]')
		.filter({ hasText: String(y) })
		.first()
		.click();
	await popover.getByLabel(/^(Month|Mês)$/).click();
	await page
		.locator('[data-slot="select-content"][data-state="open"] [data-slot="select-item"]')
		.nth(m - 1)
		.click();
	for (const day of [from, to]) {
		await popover
			.locator('[data-slot="calendar-day"]:not([data-outside-month])')
			.filter({ hasText: new RegExp(`^${Number(day.slice(8))}$`) })
			.first()
			.click();
	}
	await expect(popover).toBeHidden();
}
