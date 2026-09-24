import type { ClientApi } from '$db/api';
import type { MoneyFormat } from '$domain/money';
import { m } from '$i18n/paraglide/messages';
import type { FormContext } from './form';

/** Loads what the transaction and schedule forms offer: accounts, payees and categories. */
export async function loadFormContext(api: ClientApi, money: MoneyFormat): Promise<FormContext> {
	const [accounts, payees, tree] = await Promise.all([
		api.accounts.list(),
		api.payees.list(),
		api.categories.tree()
	]);
	return {
		accounts,
		payees,
		tree,
		money,
		transferLabel: (account) => m.transfer_payee({ account })
	};
}
