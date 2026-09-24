/**
 * Whether a payee name is the starting balance one, in either language. Reports and the register
 * recognize starting balances by this name, so these payees can't be renamed, merged or deleted.
 */
export function isStartingBalance(payeeName: string | null | undefined): boolean {
	if (!payeeName) return false;
	const lower = payeeName.trim().toLowerCase();
	return lower === 'starting balance' || lower === 'saldo inicial';
}
