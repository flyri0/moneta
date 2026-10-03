import { DomainError } from '$domain/errors';
import type { Db, Table } from './connection';

/**
 * The size of every amount and assignment added up. No balance, activity, available or Ready to
 * Assign can be larger, so while it stays within the safe integer range they all add up exactly
 * (and SQLite never hands back a BigInt).
 */
export const AMOUNT_SIZE_SQL = `(SELECT TOTAL(ABS(amount)) FROM transactions)
	+ (SELECT TOTAL(ABS(assigned)) FROM budget_assignments)`;

/** Tables whose writes can grow AMOUNT_SIZE_SQL. */
export function writesAmounts(tables: readonly Table[]): boolean {
	return tables.includes('transactions') || tables.includes('budget_assignments');
}

/** AMOUNT_TOO_LARGE when the budget's amounts add up past the safe integer range. */
export function checkAmountRange(db: Db): void {
	if ((db.selectValue(`SELECT ${AMOUNT_SIZE_SQL}`) as number) > Number.MAX_SAFE_INTEGER)
		throw new DomainError('AMOUNT_TOO_LARGE');
}
