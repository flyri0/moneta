import { describe, it, expect } from 'vitest';
import { installmentMemo, occurrenceMemo, splitInstallments } from './installments';

describe('splitInstallments', () => {
	it('splits evenly when the total divides', () => {
		expect(splitInstallments(120000, 12)).toEqual({ first: 10000, rest: 10000 });
	});

	it('puts the leftover cents in the first installment', () => {
		expect(splitInstallments(100000, 3)).toEqual({ first: 33334, rest: 33333 });
		expect(splitInstallments(5, 3)).toEqual({ first: 3, rest: 1 });
	});

	it('adds up to the total', () => {
		const { first, rest } = splitInstallments(99999, 7);
		expect(first + rest * 6).toBe(99999);
	});
});

describe('installmentMemo', () => {
	it('numbers the memo', () => {
		expect(installmentMemo('TV', 2, 12)).toBe('TV 2/12');
	});

	it('is just the number when there is no memo', () => {
		expect(installmentMemo('', 1, 3)).toBe('1/3');
		expect(installmentMemo('  ', 1, 3)).toBe('1/3');
	});
});

describe('occurrenceMemo', () => {
	it('numbers an installment schedule from its start, up to its last one', () => {
		const s = { memo: 'TV', installmentStart: 3, endCount: 10 };
		expect(occurrenceMemo(s, 0)).toBe('TV 3/12');
		expect(occurrenceMemo(s, 9)).toBe('TV 12/12');
	});

	it('leaves other schedules alone', () => {
		expect(occurrenceMemo({ memo: 'rent', installmentStart: null, endCount: 12 }, 1)).toBe('rent');
		expect(occurrenceMemo({ memo: 'rent', installmentStart: 1, endCount: null }, 1)).toBe('rent');
	});
});
