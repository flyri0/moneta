import { describe, it, expect } from 'vitest';
import { foldText, searchTerms } from './search';

const BRL = { currency: 'BRL', locale: 'pt-BR' };
const USD = { currency: 'USD', locale: 'en-US' };

describe('foldText', () => {
	it('lowercases and drops accents', () => {
		expect(foldText('Açougue São João')).toBe('acougue sao joao');
		expect(foldText('CAFÉ')).toBe('cafe');
		expect(foldText('Crème Brûlée')).toBe('creme brulee');
	});

	it('leaves plain lowercase text as it is', () => {
		expect(foldText('credit card')).toBe('credit card');
		expect(foldText('')).toBe('');
	});
});

describe('searchTerms', () => {
	it('splits on whitespace into folded terms', () => {
		expect(searchTerms('  Credit   Mercado ', BRL)).toEqual([
			{ text: 'credit', amount: null },
			{ text: 'mercado', amount: null }
		]);
	});

	it('returns no terms for blank text', () => {
		expect(searchTerms('   ', BRL)).toEqual([]);
	});

	it('drops repeated terms', () => {
		expect(searchTerms('café Cafe', BRL)).toEqual([{ text: 'cafe', amount: null }]);
	});

	it('reads amounts in the budget format, either sign, with either separator', () => {
		expect(searchTerms('45,90', BRL)).toEqual([{ text: '45,90', amount: 4590 }]);
		expect(searchTerms('45.90', BRL)).toEqual([{ text: '45.90', amount: 4590 }]);
		expect(searchTerms('-12', USD)).toEqual([{ text: '-12', amount: 1200 }]);
		expect(searchTerms('1,234.50', USD)).toEqual([{ text: '1,234.50', amount: 123450 }]);
	});

	it('keeps at most eight terms', () => {
		expect(searchTerms('a b c d e f g h i j', BRL).map((t) => t.text)).toEqual([
			'a',
			'b',
			'c',
			'd',
			'e',
			'f',
			'g',
			'h'
		]);
	});
});
