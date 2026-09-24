import { expect, test } from '@playwright/test';
import { chooseCombobox, onboard, pickDate } from './helpers';

/** A local date `days` from today, as YYYY-MM-DD. */
function daysFromToday(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mm}-${dd}`;
}

test('schedules a monthly bill, forecasts it and enters it', async ({ page }) => {
	await onboard(page);
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
	await expect(page.getByText('No schedules yet.')).toBeVisible();

	await page.getByRole('button', { name: 'Add schedule' }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Landlord', 'Landlord');
	await dialog.getByLabel('Amount', { exact: true }).fill('400');
	await chooseCombobox(dialog, 'Category', 'Rent', 'Rent');
	await pickDate(dialog, 'Next date', daysFromToday(3));
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const schedule = page.getByTestId('schedule-row');
	await expect(schedule).toContainText('Landlord');
	await expect(schedule).toContainText('Every month');
	await expect(schedule).toContainText('-$400.00');

	await sidebar.getByRole('link', { name: 'Accounts' }).click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	const upcoming = page.getByTestId('upcoming-row');
	await expect(upcoming).toHaveCount(1);
	await expect(upcoming.getByTestId('upcoming-balance')).toHaveText('$600.00');
	await expect(page.getByTestId('register-projected')).toHaveText('$600.00');

	await upcoming.getByRole('button', { name: 'Enter' }).click();
	await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue(/400/);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await expect(page.getByTestId('register-row').filter({ hasText: 'Landlord' })).toContainText(
		'-$400.00'
	);
	// The next one is a month away, past the 30-day forecast.
	await expect(upcoming).toHaveCount(0);
	await expect(page.getByTestId('register-balance')).toHaveText('$600.00');
});

/** Adds an automatic $2,000 paycheck from "Employer" to Checking, next on `date`. */
async function addAutomaticPaycheck(page: import('@playwright/test').Page, date: string) {
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Schedules' }).click();
	await page.getByRole('button', { name: 'Add schedule' }).click();
	const dialog = page.getByRole('dialog');
	await chooseCombobox(dialog, 'Payee', 'Employer', 'Employer');
	await dialog.getByRole('button', { name: 'Inflow' }).click();
	await dialog.getByLabel('Amount', { exact: true }).fill('2000');
	await chooseCombobox(dialog, 'Category', 'Salary', 'Salary');
	await pickDate(dialog, 'Next date', date);
	await dialog.getByLabel('Enter automatically').click();
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

async function expectPaycheckEntered(page: import('@playwright/test').Page) {
	const sidebar = page.getByRole('complementary').getByRole('navigation', { name: 'Main' });
	await sidebar.getByRole('link', { name: 'Accounts' }).click();
	await page
		.getByRole('main')
		.getByTestId('account-row')
		.filter({ hasText: 'Checking' })
		.getByRole('link')
		.click();
	await expect(page.getByTestId('register-row').filter({ hasText: 'Employer' })).toContainText(
		'$2,000.00'
	);
	await expect(page.getByTestId('register-balance')).toHaveText('$3,000.00');
}

test('enters an automatic schedule that is already due as soon as it is saved', async ({
	page
}) => {
	await onboard(page);
	await addAutomaticPaycheck(page, daysFromToday(-1));
	await expect(page.getByText('Scheduled transactions entered: 1')).toBeVisible();
	await expectPaycheckEntered(page);
});

test('enters an automatic schedule when the app opens on or after its date', async ({ page }) => {
	await onboard(page);
	await addAutomaticPaycheck(page, daysFromToday(1));
	await expect(page.getByTestId('schedule-row')).toContainText('Employer');

	await page.clock.setFixedTime(new Date(Date.now() + 2 * 86_400_000));
	await page.reload();
	await expect(page.getByText('Scheduled transactions entered: 1')).toBeVisible();
	await expectPaycheckEntered(page);
});
