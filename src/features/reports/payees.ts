import type { PayeeSpendingRow } from '$db/repos/reports';
import { m } from '$i18n/paraglide/messages';
import type { Slice } from './spending';

/** The key of the row for transactions without a payee. */
export const NO_PAYEE = '__none';

/** Payee rows as stacked-bar slices, the ones without a payee named as such. */
export function payeeSlices(rows: PayeeSpendingRow[]): Slice[] {
	return rows.map((r) => ({
		key: r.payeeId ?? NO_PAYEE,
		label: r.name ?? m.reports_no_payee(),
		amount: r.amount
	}));
}
