import { describe, expect, it } from 'vitest';
import { ruleDraft, ruleSummary } from './rules';

describe('ruleDraft', () => {
	it('starts with the words before what changes between charges', () => {
		expect(ruleDraft('UBER *TRIP 8H2K', 'Uber').text).toBe('UBER');
		expect(ruleDraft('PIX ENVIADO MARIA 123', 'Maria').text).toBe('PIX ENVIADO MARIA');
		expect(ruleDraft('NETFLIX.COM   SAO PAULO', 'Netflix').text).toBe('NETFLIX.COM');
		expect(ruleDraft('Padaria São João', 'Padaria', 'food')).toEqual({
			kind: 'starts',
			text: 'Padaria São João',
			payeeName: 'Padaria',
			categoryId: 'food'
		});
	});

	it('keeps the whole description when it starts with a number', () => {
		expect(ruleDraft('99 FOOD', 'x').text).toBe('99 FOOD');
	});
});

describe('ruleSummary', () => {
	it('reads the kind and the text', () => {
		expect(ruleSummary({ kind: 'starts', text: 'UBER' })).toBe('Starts with “UBER”');
		expect(ruleSummary({ kind: 'is', text: 'Uber' })).toBe('Is exactly “Uber”');
	});
});
