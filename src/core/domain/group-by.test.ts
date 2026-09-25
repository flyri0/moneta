import { describe, it, expect } from 'vitest';
import { groupBy } from './group-by';

describe('groupBy', () => {
	it('groups items by key, keeping their order within each group', () => {
		const rows = [
			{ k: 'a', n: 1 },
			{ k: 'b', n: 2 },
			{ k: 'a', n: 3 }
		];
		expect([...groupBy(rows, (r) => r.k)]).toEqual([
			['a', [rows[0], rows[2]]],
			['b', [rows[1]]]
		]);
	});
});
