import { MAX_INSTALLMENTS, splitInstallments } from '$domain/installments';
import { parseAmount } from '$domain/money';
import type { FormContext, TransactionDraft } from './form';

/** Only a card purchase (an outflow, not a transfer or split) can be paid in installments. */
export function canInstall(draft: TransactionDraft, ctx: FormContext): boolean {
	const account = ctx.accounts.find((a) => a.id === draft.accountId);
	return (
		account?.type === 'credit_card' &&
		draft.direction === 'outflow' &&
		!draft.transferAccountId &&
		draft.splits === null
	);
}

/**
 * How many installments the form asks for: 1 for a single payment (blank, "1", or not a card
 * purchase). Null when the text isn't a whole number from 1 to 99, or an installment would be
 * less than a cent.
 */
export function installmentCount(
	draft: TransactionDraft,
	ctx: FormContext,
	text: string
): number | null {
	const trimmed = text.trim();
	if (!canInstall(draft, ctx) || trimmed === '') return 1;
	if (!/^\d{1,2}$/.test(trimmed)) return null;
	const count = Number(trimmed);
	if (count < 1 || count > MAX_INSTALLMENTS) return null;
	const total = parseAmount(draft.amount, ctx.money);
	if (count > 1 && total !== null && total < count) return null;
	return count;
}

export interface InstallmentPlan {
	count: number;
	/** The first installment, which takes the cents left over. Positive. */
	first: number;
	/** Each of the others. Positive. */
	rest: number;
}

/** What each installment comes to, for the form to show; null for a single payment. */
export function installmentPlan(
	draft: TransactionDraft,
	ctx: FormContext,
	text: string
): InstallmentPlan | null {
	const count = installmentCount(draft, ctx, text);
	const total = parseAmount(draft.amount, ctx.money);
	if (count === null || count < 2 || total === null || total <= 0) return null;
	return { count, ...splitInstallments(total, count) };
}
