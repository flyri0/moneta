import { describe, expect, it } from 'vitest';
import type { ImportPreview, StatementLine } from '$db/repos/imports';
import {
	applyRule,
	farFutureCount,
	fillCategories,
	importLines,
	reviewCounts,
	reviewRows
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
		]
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

	it('leaves lines it does not catch', () => {
		const r = rows();
		applyRule(r, { ...rule, kind: 'is', text: 'Shop' });
		expect(r.every((x) => x.ruleId === null)).toBe(true);
	});

	it('counts the included lines dated over two years ahead', () => {
		const all = rows();
		all[0].line = { ...all[0].line, date: '2029-01-05' };
		all[1].line = { ...all[1].line, date: '2029-01-05' };
		all[1].include = false;
		all[3].line = { ...all[3].line, date: '2031-01-05' };
		expect(farFutureCount(all, '2026-10-02')).toBe(1);
	});
});
