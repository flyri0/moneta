import { describe, expect, it } from 'vitest';
import type { ImportPreview, StatementLine } from '$db/repos/imports';
import {
	applyRule,
	beforeOpeningCount,
	farFutureCount,
	fillCategories,
	importLines,
	linkPossible,
	newCategoryGroupsFor,
	reviewCounts,
	reviewRows,
	type ReviewRow,
	rowStatus,
	suggestCategory
} from './review';

const line = (n: number): StatementLine => ({
	date: '2026-01-05',
	amount: -100 * n,
	description: `Shop ${n}`,
	memo: n === 1 ? 'memo' : '',
	importId: `ofx:${n}`
});
const preview = (status: ImportPreview['status'], over: Partial<ImportPreview> = {}) => ({
	status,
	importId: '',
	match: null,
	payeeName: 'Shop',
	categoryId: null,
	ruleId: null,
	...over
});

function rows() {
	return reviewRows(
		[line(1), line(2), line(3), line(4)],
		[
			preview('new', { categoryId: 'food' }),
			preview('new'),
			preview('match', { match: { id: 't9', date: '2026-01-04', payeeName: null, memo: '' } }),
			preview('duplicate')
		].map((p, i) => ({ ...p, importId: `ofx:${i + 1}` }))
	);
}

describe('review', () => {
	it('includes everything but duplicates, with the suggested categories', () => {
		expect(rows().map((r) => [r.include, r.categoryId])).toEqual([
			[true, 'food'],
			[true, ''],
			[true, ''],
			[false, '']
		]);
	});

	it('counts what an import does, and the categories still missing', () => {
		const r = rows();
		expect(reviewCounts(r, true)).toEqual({ create: 2, match: 1, missing: 1 });
		expect(reviewCounts(r, false)).toEqual({ create: 2, match: 1, missing: 0 });
		r[1].include = false;
		expect(reviewCounts(r, true)).toEqual({ create: 1, match: 1, missing: 0 });
	});

	it('counts a category still to be created as chosen', () => {
		const r = rows();
		r[1].categoryId = 'new-category:1';
		expect(reviewCounts(r, true).missing).toBe(0);
	});

	it('fills the missing categories only', () => {
		const r = rows();
		fillCategories(r, 'fun', true);
		expect(r.map((x) => x.categoryId)).toEqual(['food', 'fun', '', '']);
	});

	it('sends the included new and matched lines', () => {
		const r = rows();
		r[1].categoryId = 'fun';
		r[1].payeeName = ' Renamed ';
		expect(importLines(r, true)).toEqual([
			{
				importId: 'ofx:1',
				date: '2026-01-05',
				amount: -100,
				payeeName: 'Shop',
				memo: 'memo',
				categoryId: 'food',
				matchId: null
			},
			expect.objectContaining({ importId: 'ofx:2', payeeName: 'Renamed', categoryId: 'fun' }),
			expect.objectContaining({ importId: 'ofx:3', categoryId: null, matchId: 't9' })
		]);
		expect(importLines(r, false)[0].categoryId).toBeNull();
	});
});

describe('applyRule', () => {
	const rule = {
		id: 'r1',
		kind: 'starts' as const,
		text: 'shop',
		payeeName: 'The Shop',
		categoryId: 'fun'
	};

	it('gives the rule to new lines it catches that keep their payee', () => {
		const r = rows();
		r[0].payeeName = 'Renamed by hand';
		r[1].payeeName = 'the shop';
		applyRule(r, rule);
		expect(r.map((x) => [x.payeeName, x.categoryId, x.ruleId])).toEqual([
			['Renamed by hand', 'food', null],
			['The Shop', 'fun', 'r1'],
			['Shop', '', null],
			['Shop', '', null]
		]);
	});

	it("keeps a line's category when the rule has none", () => {
		const r = rows();
		applyRule(r, { ...rule, categoryId: null });
		expect(r[0]).toMatchObject({ payeeName: 'The Shop', categoryId: 'food', ruleId: 'r1' });
	});

	it("fills the payee's usual category when the rule has none", () => {
		const r = rows();
		applyRule(r, { ...rule, categoryId: null }, { 'the shop': 'fun' });
		// Lines 1 and 2 are new and caught; line 1 already had 'food', which stays.
		expect(r.map((x) => [x.ruleId, x.categoryId])).toEqual([
			['r1', 'food'],
			['r1', 'fun'],
			[null, ''],
			[null, '']
		]);
	});

	it('leaves lines it does not catch', () => {
		const r = rows();
		applyRule(r, { ...rule, kind: 'is', text: 'Shop' });
		expect(r.every((x) => x.ruleId === null)).toBe(true);
	});

	it('counts the lines dated over two years ahead, checked or not', () => {
		const all = rows();
		all[0].line = { ...all[0].line, date: '2029-01-05' };
		all[1].line = { ...all[1].line, date: '2029-01-05' };
		all[1].include = false;
		all[3].line = { ...all[3].line, date: '2031-01-05' };
		expect(farFutureCount(all, '2026-10-02')).toBe(2);
	});
});

describe('possible matches', () => {
	const possibleRows = () =>
		reviewRows(
			[line(1)],
			[
				preview('possible', {
					importId: 'ofx:1',
					categoryId: 'food',
					match: { id: 't7', date: '2026-01-01', payeeName: 'Shop', memo: '' }
				})
			]
		);

	it('starts unchecked, as a new line', () => {
		const [r] = possibleRows();
		expect(r.include).toBe(false);
		expect(rowStatus(r)).toBe('new');
	});

	it('imports as new when checked without linking', () => {
		const r = possibleRows();
		r[0].include = true;
		expect(importLines(r, true)[0]).toMatchObject({ matchId: null, categoryId: 'food' });
		expect(reviewCounts(r, true)).toEqual({ create: 1, match: 0, missing: 0 });
	});

	it('matches once linked, and goes back to new when unlinked', () => {
		const r = possibleRows();
		linkPossible(r[0], true);
		expect(r[0].include).toBe(true);
		expect(importLines(r, true)[0]).toMatchObject({ matchId: 't7', categoryId: null });
		expect(reviewCounts(r, true)).toEqual({ create: 0, match: 1, missing: 0 });
		linkPossible(r[0], false);
		expect(rowStatus(r[0])).toBe('new');
	});
});

describe('suggestCategory', () => {
	const suggestions = { mercado: 'food' };

	it('fills an empty category from a payee typed by hand', () => {
		const [, second] = rows();
		second.payeeName = ' Mercado ';
		suggestCategory(second, suggestions);
		expect(second.categoryId).toBe('food');
	});

	it('never replaces a category the user picked, nor touches a match', () => {
		const [first, , third] = rows();
		first.payeeName = 'Mercado';
		first.categoryId = 'fun';
		suggestCategory(first, suggestions);
		expect(first.categoryId).toBe('fun');
		third.payeeName = 'Mercado';
		suggestCategory(third, suggestions);
		expect(third.categoryId).toBe('');
	});
});

describe('lines that start unchecked', () => {
	const dated = (dates: string[], statuses: ImportPreview['status'][]) =>
		reviewRows(
			dates.map((date, i) => ({ ...line(i + 1), date })),
			statuses.map((s, i) => ({ ...preview(s), importId: `ofx:${i + 1}` })),
			{ today: '2026-01-10', openingDate: '2026-01-05' }
		);

	it('leaves out new lines dated before the starting balance, and counts them', () => {
		const r = dated(['2026-01-04', '2026-01-05', '2026-01-04'], ['new', 'new', 'match']);
		expect(r.map((x) => x.include)).toEqual([false, true, true]);
		expect(beforeOpeningCount(r, '2026-01-05')).toBe(1);
	});

	it('leaves out lines dated over two years ahead', () => {
		const r = dated(['2029-01-04', '2026-01-08'], ['new', 'match']);
		expect(r.map((x) => x.include)).toEqual([false, true]);
	});

	it('leaves everything in for an account opened at zero', () => {
		const r = reviewRows([line(1)], [{ ...preview('new'), importId: 'ofx:1' }], {
			today: '2026-01-10',
			openingDate: null
		});
		expect(r[0].include).toBe(true);
		expect(beforeOpeningCount(r, null)).toBe(0);
	});
});

describe('newCategoryGroupsFor', () => {
	const groups = [
		{ id: 'a', name: 'Bills', system: null },
		{ id: 'i', name: 'Income', system: 'income' as const },
		{ id: 'h', name: 'Old', system: null, hidden: true }
	];
	const newRow = (amount: number, over: Partial<ReviewRow> = {}): ReviewRow => ({
		...reviewRows([{ ...line(1), amount }], [{ ...preview('new'), importId: 'ofx:1' }])[0],
		...over
	});

	it('leaves Income out when every new row is an outflow', () => {
		const ids = newCategoryGroupsFor(groups, [newRow(-100), newRow(-5)]).map((g) => g.id);
		expect(ids).toEqual(['a']);
	});

	it('keeps Income when one of them is an inflow', () => {
		const ids = newCategoryGroupsFor(groups, [newRow(-100), newRow(500)]).map((g) => g.id);
		expect(ids).toEqual(['a', 'i']);
	});

	it('ignores rows that are left out or not new', () => {
		const rs = [
			newRow(500, { include: false }),
			newRow(500, { linked: true, preview: preview('possible', { importId: 'ofx:1' }) }),
			newRow(-1)
		];
		expect(newCategoryGroupsFor(groups, rs).map((g) => g.id)).toEqual(['a']);
	});
});
