import { describe, it, expect } from 'vitest';
import type { GroupNode } from '$db/repos/categories';
import type { TransactionRow } from '$db/repos/transactions';
import {
	buildTransactionInput,
	canSplit,
	categoryMode,
	categoryOptions,
	draftFromTransaction,
	newDraft,
	splitRemaining,
	suggestCategory,
	transferTarget,
	type FormAccount,
	type FormContext,
	type TransactionDraft
} from './form';

const acct = (id: string, type: FormAccount['type'], onBudget = true, closed = false) => ({
	id,
	name: id[0].toUpperCase() + id.slice(1),
	type,
	onBudget,
	closed
});

const category = (
	id: string,
	groupId: string,
	extra: Partial<GroupNode['categories'][number]> = {}
): GroupNode['categories'][number] => ({
	id,
	groupId,
	name: id[0].toUpperCase() + id.slice(1),
	sortOrder: 0,
	hidden: false,
	carryoverOverspending: false,
	...extra
});

const tree: GroupNode[] = [
	{
		id: 'income',
		name: 'Income',
		sortOrder: 0,
		hidden: false,
		system: 'income',
		categories: [category('rta', 'income', { name: 'Ready to Assign' })]
	},
	{
		id: 'everyday',
		name: 'Everyday',
		sortOrder: 1,
		hidden: false,
		system: null,
		categories: [category('food', 'everyday'), category('old', 'everyday', { hidden: true })]
	}
];

const ctx: FormContext = {
	accounts: [
		acct('checking', 'checking'),
		acct('savings', 'savings'),
		acct('visa', 'credit_card'),
		acct('broker', 'investment', false),
		acct('closedbank', 'checking', true, true)
	],
	payees: [
		{ id: 'p1', name: 'Mercado', lastCategoryId: 'food' },
		{ id: 'p2', name: 'Oldshop', lastCategoryId: 'old' }
	],
	tree,
	money: { currency: 'BRL', locale: 'pt-BR' },
	transferLabel: (name) => `Transfer: ${name}`
};

const draft = (p: Partial<TransactionDraft>): TransactionDraft => ({
	...newDraft('checking', '2026-09-05'),
	...p
});

describe('newDraft', () => {
	it('starts as an uncleared outflow with no category', () => {
		expect(newDraft('checking', '2026-09-05')).toEqual({
			accountId: 'checking',
			date: '2026-09-05',
			payee: '',
			categoryId: '',
			amount: '',
			direction: 'outflow',
			memo: '',
			cleared: false,
			splits: null
		});
	});
});

describe('transfers in the payee field', () => {
	it('recognizes transfer labels for other open accounts only', () => {
		expect(transferTarget(draft({ payee: 'Transfer: Savings' }), ctx)?.id).toBe('savings');
		expect(transferTarget(draft({ payee: 'Transfer: Checking' }), ctx)).toBeNull();
		expect(transferTarget(draft({ payee: 'Transfer: Closedbank' }), ctx)).toBeNull();
		expect(transferTarget(draft({ payee: 'Mercado' }), ctx)).toBeNull();
	});
});

describe('categoryMode', () => {
	it.each([
		['checking', '', 'required'],
		['visa', '', 'required'],
		['broker', '', 'hidden'],
		['checking', 'Transfer: Savings', 'hidden'],
		['checking', 'Transfer: Visa', 'hidden'],
		['checking', 'Transfer: Broker', 'required'],
		['broker', 'Transfer: Checking', 'required']
	])('%s with payee "%s" → %s', (accountId, payee, mode) => {
		expect(categoryMode(draft({ accountId, payee }), ctx)).toBe(mode);
	});

	it('hides the category while split', () => {
		expect(categoryMode(draft({ splits: [] }), ctx)).toBe('hidden');
	});

	it('requires category for non-transfer credit card spending', () => {
		const draft = { ...newDraft('visa', '2026-01-05'), amount: '50' };
		expect(categoryMode(draft, ctx)).toBe('required');
	});

	it('hides category for transfers between checking and credit card', () => {
		const draft = {
			...newDraft('checking', '2026-01-05'),
			amount: '50',
			payee: ctx.transferLabel('Visa')
		};
		expect(categoryMode(draft, ctx)).toBe('hidden');
	});
});

describe('canSplit', () => {
	it('allows splits on on-budget accounts, but not on transfers', () => {
		expect(canSplit(draft({}), ctx)).toBe(true);
		expect(canSplit(draft({ accountId: 'broker' }), ctx)).toBe(false);
		expect(canSplit(draft({ payee: 'Transfer: Savings' }), ctx)).toBe(false);
	});
});

describe('categoryOptions', () => {
	const ids = (d: TransactionDraft) =>
		categoryOptions(d, ctx).flatMap((g) => g.categories.map((c) => c.id));

	it('offers income categories in category options for credit card transactions', () => {
		const draft = newDraft('visa', '2026-01-05');
		const options = categoryOptions(draft, ctx);
		const income = options.find((g) => g.system === 'income');
		expect(income).toBeDefined();
	});

	it('never offers hidden categories unless chosen', () => {
		expect(ids(draft({}))).toEqual(['rta', 'food']);
	});

	it('keeps a hidden category that is already chosen', () => {
		expect(ids(draft({ categoryId: 'old' }))).toEqual(['rta', 'food', 'old']);
	});
});

describe('suggestCategory', () => {
	it("suggests the payee's last category when it is offered", () => {
		expect(suggestCategory(draft({ payee: 'mercado' }), ctx)).toBe('food');
		expect(suggestCategory(draft({ payee: 'Oldshop' }), ctx)).toBeNull();
		expect(suggestCategory(draft({ payee: 'Someone new' }), ctx)).toBeNull();
	});
});

describe('buildTransactionInput', () => {
	it('builds a categorized outflow', () => {
		expect(
			buildTransactionInput(
				draft({
					payee: ' Mercado ',
					categoryId: 'food',
					amount: '12,50',
					memo: ' pão ',
					cleared: true
				}),
				ctx
			)
		).toEqual({
			ok: true,
			input: {
				accountId: 'checking',
				date: '2026-09-05',
				amount: -1250,
				memo: 'pão',
				cleared: true,
				payeeName: 'Mercado',
				categoryId: 'food'
			}
		});
	});

	it('builds income with arithmetic', () => {
		const result = buildTransactionInput(
			draft({ categoryId: 'rta', amount: '1000+250,5', direction: 'inflow' }),
			ctx
		);
		expect(result).toMatchObject({ ok: true, input: { amount: 125050, categoryId: 'rta' } });
	});

	it('requires category for card spending', () => {
		expect(buildTransactionInput(draft({ accountId: 'visa', amount: '10' }), ctx)).toEqual({
			ok: false,
			error: 'CATEGORY_REQUIRED'
		});
		expect(
			buildTransactionInput(draft({ accountId: 'visa', amount: '10', categoryId: 'food' }), ctx)
		).toMatchObject({
			ok: true,
			input: { accountId: 'visa', amount: -1000, categoryId: 'food' }
		});
	});

	it('builds transfers, with a category only across the budget boundary', () => {
		expect(
			buildTransactionInput(
				draft({ payee: 'Transfer: Savings', categoryId: 'food', amount: '5' }),
				ctx
			)
		).toEqual({
			ok: true,
			input: {
				accountId: 'checking',
				date: '2026-09-05',
				amount: -500,
				memo: '',
				cleared: false,
				transferAccountId: 'savings',
				categoryId: null
			}
		});
		expect(
			buildTransactionInput(
				draft({ payee: 'Transfer: Broker', categoryId: 'food', amount: '5' }),
				ctx
			)
		).toMatchObject({ ok: true, input: { transferAccountId: 'broker', categoryId: 'food' } });
	});

	it('builds splits whose lines follow the direction', () => {
		const result = buildTransactionInput(
			draft({
				amount: '30',
				splits: [
					{ categoryId: 'food', amount: '35', memo: '' },
					{ categoryId: 'rta', amount: '-5', memo: ' refund ' }
				]
			}),
			ctx
		);
		expect(result).toMatchObject({
			ok: true,
			input: {
				amount: -3000,
				splits: [
					{ categoryId: 'food', amount: -3500, memo: '' },
					{ categoryId: 'rta', amount: 500, memo: 'refund' }
				]
			}
		});
		expect(result.ok && 'categoryId' in result.input).toBe(false);
	});

	it.each([
		[{ accountId: 'nope' }, 'ACCOUNT_REQUIRED'],
		[{ date: '2026-02-30', categoryId: 'food', amount: '1' }, 'DATE_INVALID'],
		[{ categoryId: 'food', amount: '' }, 'AMOUNT_INVALID'],
		[{ categoryId: 'food', amount: '-5' }, 'AMOUNT_INVALID'],
		[{ categoryId: 'food', amount: '1e5' }, 'AMOUNT_INVALID'],
		[{ amount: '5' }, 'CATEGORY_REQUIRED'],
		[{ accountId: 'broker', payee: 'Transfer: Checking', amount: '5' }, 'CATEGORY_REQUIRED'],
		[
			{ amount: '5', splits: [{ categoryId: 'food', amount: '5', memo: '' }] },
			'SPLIT_TOO_FEW_LINES'
		],
		[
			{
				amount: '5',
				splits: [
					{ categoryId: 'food', amount: '5', memo: '' },
					{ categoryId: '', amount: '0', memo: '' }
				]
			},
			'SPLIT_LINE_INVALID'
		],
		[
			{
				amount: '5',
				splits: [
					{ categoryId: 'food', amount: '3', memo: '' },
					{ categoryId: 'rta', amount: '1', memo: '' }
				]
			},
			'SPLIT_SUM_MISMATCH'
		]
	] as [Partial<TransactionDraft>, string][])('rejects %o with %s', (patch, error) => {
		expect(buildTransactionInput(draft(patch), ctx)).toEqual({ ok: false, error });
	});
});

describe('splitRemaining', () => {
	it('tracks what is left to split, and waits for readable amounts', () => {
		const d = draft({
			amount: '30',
			splits: [
				{ categoryId: 'food', amount: '10', memo: '' },
				{ categoryId: '', amount: '', memo: '' }
			]
		});
		expect(splitRemaining(d, ctx.money)).toBe(-2000);
		expect(splitRemaining({ ...d, direction: 'inflow' }, ctx.money)).toBe(2000);
		expect(splitRemaining({ ...d, amount: 'x' }, ctx.money)).toBeNull();
	});
});

describe('draftFromTransaction', () => {
	const row = (p: Partial<TransactionRow>): TransactionRow => ({
		id: 't1',
		accountId: 'checking',
		accountName: 'Checking',
		date: '2026-09-05',
		amount: -1250,
		payeeId: 'p1',
		payeeName: 'Mercado',
		categoryId: 'food',
		categoryName: 'Food',
		memo: 'pão',
		cleared: true,
		transferId: null,
		transferAccountId: null,
		transferAccountName: null,
		isSplit: false,
		splits: [],
		...p
	});

	it('round-trips a plain transaction', () => {
		const d = draftFromTransaction(row({}), ctx);
		expect(d).toMatchObject({ payee: 'Mercado', amount: '12,50', direction: 'outflow' });
		expect(buildTransactionInput(d, ctx)).toMatchObject({
			ok: true,
			input: { amount: -1250, payeeName: 'Mercado', categoryId: 'food', memo: 'pão', cleared: true }
		});
	});

	it('round-trips a split with a line in the other direction', () => {
		const d = draftFromTransaction(
			row({
				amount: -3000,
				categoryId: null,
				isSplit: true,
				splits: [
					{ id: 's1', categoryId: 'food', categoryName: 'Food', amount: -3500, memo: '' },
					{ id: 's2', categoryId: 'rta', categoryName: 'Ready to Assign', amount: 500, memo: '' }
				]
			}),
			ctx
		);
		expect(d.splits?.map((s) => s.amount)).toEqual(['35,00', '-5,00']);
		expect(buildTransactionInput(d, ctx)).toMatchObject({ ok: true, input: { amount: -3000 } });
	});

	it("takes a transfer's category from the on-budget leg", () => {
		const offLeg = row({
			accountId: 'broker',
			amount: 500,
			payeeName: null,
			categoryId: null,
			transferId: 't2',
			transferAccountId: 'checking',
			transferAccountName: 'Checking'
		});
		const onLeg = row({ id: 't2', categoryId: 'food' });
		const d = draftFromTransaction(offLeg, ctx, onLeg);
		expect(d).toMatchObject({
			payee: 'Transfer: Checking',
			categoryId: 'food',
			direction: 'inflow'
		});
		expect(buildTransactionInput(d, ctx)).toMatchObject({
			ok: true,
			input: { accountId: 'broker', amount: 500, transferAccountId: 'checking', categoryId: 'food' }
		});
	});
});
