import { readHideAmounts, writeHideAmounts } from './hide-amounts';

/** Storage, where there is any (not in unit tests). */
const store = typeof localStorage === 'undefined' ? null : localStorage;

/**
 * Whether money amounts are hidden on every screen, for using the app in public or sharing the
 * screen. `BudgetSession.format` reads it, so everything that shows an amount follows it.
 */
export const amounts = $state({ hidden: store ? readHideAmounts(store) : false });

/** Hides amounts if they show, shows them if hidden, and remembers it on this device. */
export function toggleHideAmounts(): void {
	amounts.hidden = !amounts.hidden;
	if (store) writeHideAmounts(store, amounts.hidden);
}
