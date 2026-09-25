import { describe, it, expect } from 'vitest';
import { m } from '$i18n/paraglide/messages';
import { NO_PAYEE, payeeSlices } from './payees';

describe('payeeSlices', () => {
	it('keys each payee by id, and names the row without a payee', () => {
		expect(
			payeeSlices([
				{ payeeId: 'p1', name: 'Market', amount: 900 },
				{ payeeId: null, name: null, amount: 100 }
			])
		).toEqual([
			{ key: 'p1', label: 'Market', amount: 900 },
			{ key: NO_PAYEE, label: m.reports_no_payee(), amount: 100 }
		]);
	});
});
