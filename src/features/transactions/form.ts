import type { Account } from '$db/repos/accounts';
import type { GroupNode } from '$db/repos/categories';
import type { Payee } from '$db/repos/payees';
import type { SplitInput, TransactionInput, TransactionRow } from '$db/repos/transactions';
import { formatAmountInput, parseAmount, type MoneyFormat } from '$domain/money';
import { isDate } from '$domain/month';

export type Direction = 'outflow' | 'inflow';

export interface SplitDraft {
	categoryId: string;
	amount: string; // as typed; follows the transaction's direction (a negative line goes the other way)
	memo: string;
}

/** What the transaction form edits. Amounts are text so arithmetic like "120+35" works. */
export interface TransactionDraft {
	accountId: string;
	date: string;
	payee: string; // a payee name, or '' when transferAccountId is set
	transferAccountId: string | null;
	categoryId: string; // '' when none
	amount: string; // unsigned, as typed
	direction: Direction;
	memo: string;
	cleared: boolean;
	splits: SplitDraft[] | null; // null when not split
}

export type FormAccount = Pick<Account, 'id' | 'name' | 'type' | 'onBudget' | 'closed'>;

export interface FormContext {
	accounts: FormAccount[];
	payees: Payee[];
	tree: GroupNode[];
	money: MoneyFormat;
	/** How a transfer to or from an account appears in the payee field, e.g. "Transfer: Savings". */
	transferLabel?: (accountName: string) => string;
}

export function newDraft(accountId: string, date: string): TransactionDraft {
	return {
		accountId,
		date,
		payee: '',
		transferAccountId: null,
		categoryId: '',
		amount: '',
		direction: 'outflow',
		memo: '',
		cleared: false,
		splits: null
	};
}

function findAccount(ctx: FormContext, id: string): FormAccount | undefined {
	return ctx.accounts.find((a) => a.id === id);
}

/** Accounts the payee field offers as transfer targets. */
export function transferTargets(draft: TransactionDraft, ctx: FormContext): FormAccount[] {
	return ctx.accounts.filter((a) => !a.closed && a.id !== draft.accountId);
}

/** The account that draft.transferAccountId points at, if it holds one. */
export function transferTarget(draft: TransactionDraft, ctx: FormContext): FormAccount | null {
	if (!draft.transferAccountId) return null;
	return transferTargets(draft, ctx).find((a) => a.id === draft.transferAccountId) ?? null;
}

/**
 * The on-budget account whose budget the transaction touches, or null when it is budget-neutral:
 * off-budget activity, or a transfer between two accounts on the same side (spec rules 4 and 5).
 */
function budgetLeg(draft: TransactionDraft, ctx: FormContext): FormAccount | null {
	const own = findAccount(ctx, draft.accountId);
	if (!own) return null;
	const other = transferTarget(draft, ctx);
	if (other) {
		if (own.onBudget === other.onBudget) return null;
		return own.onBudget ? own : other;
	}
	return own.onBudget ? own : null;
}

export type CategoryMode = 'required' | 'hidden';

/** Whether the form shows the category field and whether it must be filled. */
export function categoryMode(draft: TransactionDraft, ctx: FormContext): CategoryMode {
	if (draft.splits && canSplit(draft, ctx)) return 'hidden';
	const leg = budgetLeg(draft, ctx);
	if (!leg) return 'hidden';
	return 'required';
}

/** Splitting is for categorized, non-transfer transactions on on-budget accounts. */
export function canSplit(draft: TransactionDraft, ctx: FormContext): boolean {
	return !!findAccount(ctx, draft.accountId)?.onBudget && !transferTarget(draft, ctx);
}

export interface CategoryOption {
	id: string;
	name: string;
	system: null;
}

export interface CategoryOptionGroup {
	id: string;
	name: string;
	system: GroupNode['system'];
	categories: CategoryOption[];
}

/**
 * The categories the form offers: no hidden ones unless already chosen.
 */
export function categoryOptions(draft: TransactionDraft, ctx: FormContext): CategoryOptionGroup[] {
	const chosen = new Set([draft.categoryId, ...(draft.splits ?? []).map((s) => s.categoryId)]);
	return ctx.tree
		.map((g) => ({
			id: g.id,
			name: g.name,
			system: g.system,
			categories: g.categories
				.filter((c) => !c.hidden || chosen.has(c.id))
				.map((c) => ({ id: c.id, name: c.name, system: null }))
		}))
		.filter((g) => g.categories.length > 0);
}

/** The category to preselect for an existing payee: its most recent one, if the form offers it. */
export function suggestCategory(draft: TransactionDraft, ctx: FormContext): string | null {
	const name = draft.payee.trim().toLocaleLowerCase();
	const payee = ctx.payees.find((p) => p.name.toLocaleLowerCase() === name);
	if (!payee?.lastCategoryId) return null;
	const offered = categoryOptions(draft, ctx).some((g) =>
		g.categories.some((c) => c.id === payee.lastCategoryId)
	);
	return offered ? payee.lastCategoryId : null;
}

function signed(value: number, direction: Direction): number {
	if (value === 0) return 0;
	return direction === 'outflow' ? -value : value;
}

function parseUnsigned(text: string, money: MoneyFormat): number | null {
	const value = parseAmount(text, money);
	return value === null || value < 0 ? null : value;
}

/** What is left to spread over the split lines (signed), or null while an amount is unreadable. */
export function splitRemaining(draft: TransactionDraft, money: MoneyFormat): number | null {
	const total = parseUnsigned(draft.amount, money);
	if (total === null) return null;
	let rest = signed(total, draft.direction);
	for (const line of draft.splits ?? []) {
		if (line.amount.trim() === '') continue;
		const value = parseAmount(line.amount, money);
		if (value === null) return null;
		rest -= signed(value, draft.direction);
	}
	return rest;
}

export type FormError =
	| 'ACCOUNT_REQUIRED'
	| 'DATE_INVALID'
	| 'AMOUNT_INVALID'
	| 'CATEGORY_REQUIRED'
	| 'SPLIT_LINE_INVALID'
	| 'SPLIT_TOO_FEW_LINES'
	| 'SPLIT_SUM_MISMATCH';

export type BuildResult = { ok: true; input: TransactionInput } | { ok: false; error: FormError };

const fail = (error: FormError): BuildResult => ({ ok: false, error });

/** Validates a draft and turns it into the repo's TransactionInput. */
export function buildTransactionInput(draft: TransactionDraft, ctx: FormContext): BuildResult {
	const own = findAccount(ctx, draft.accountId);
	if (!own) return fail('ACCOUNT_REQUIRED');
	if (!isDate(draft.date)) return fail('DATE_INVALID');
	const value = parseUnsigned(draft.amount, ctx.money);
	if (value === null) return fail('AMOUNT_INVALID');
	const amount = signed(value, draft.direction);
	const base = {
		accountId: own.id,
		date: draft.date,
		amount,
		memo: draft.memo.trim(),
		cleared: draft.cleared
	};
	const mode = categoryMode(draft, ctx);
	const categoryId = mode === 'hidden' ? null : draft.categoryId || null;
	if (mode === 'required' && !categoryId) return fail('CATEGORY_REQUIRED');

	const target = transferTarget(draft, ctx);
	if (target) return { ok: true, input: { ...base, transferAccountId: target.id, categoryId } };

	const payeeName = draft.payee.trim() || null;
	if (draft.splits && canSplit(draft, ctx)) {
		if (draft.splits.length < 2) return fail('SPLIT_TOO_FEW_LINES');
		const splits: SplitInput[] = [];
		for (const line of draft.splits) {
			const lineValue = parseAmount(line.amount, ctx.money);
			if (!line.categoryId || lineValue === null) return fail('SPLIT_LINE_INVALID');
			splits.push({
				categoryId: line.categoryId,
				amount: signed(lineValue, draft.direction),
				memo: line.memo.trim()
			});
		}
		if (splits.reduce((sum, s) => sum + s.amount, 0) !== amount) return fail('SPLIT_SUM_MISMATCH');
		return { ok: true, input: { ...base, payeeName, splits } };
	}
	return { ok: true, input: { ...base, payeeName, categoryId } };
}

/**
 * A draft that edits `row`. For a transfer seen from its off-budget leg, pass the other leg as
 * `pair`: the category lives on the on-budget side.
 */
export function draftFromTransaction(
	row: TransactionRow,
	ctx: FormContext,
	pair?: TransactionRow | null
): TransactionDraft {
	const direction: Direction = row.amount < 0 ? 'outflow' : 'inflow';
	const relative = (amount: number) =>
		formatAmountInput(direction === 'outflow' ? -amount : amount, ctx.money);
	return {
		accountId: row.accountId,
		date: row.date,
		payee: row.transferAccountId ? '' : (row.payeeName ?? ''),
		transferAccountId: row.transferAccountId ?? null,
		categoryId: row.categoryId ?? pair?.categoryId ?? '',
		amount: relative(row.amount),
		direction,
		memo: row.memo,
		cleared: row.cleared,
		splits: row.isSplit
			? row.splits.map((s) => ({
					categoryId: s.categoryId,
					amount: relative(s.amount),
					memo: s.memo
				}))
			: null
	};
}
