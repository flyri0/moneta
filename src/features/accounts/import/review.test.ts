import { describe, expect, it } from 'vitest';
import type { ImportPreview, StatementLine } from '$db/repos/imports';
import { fillCategories, importLines, reviewCounts, reviewRows } from './review';

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
