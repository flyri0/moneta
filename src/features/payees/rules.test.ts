import { describe, expect, it } from 'vite-plus/test';
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

	it("looks past a card processor's prefix for the merchant", () => {
		expect(ruleDraft('PAG*CORNERMKT 0423 SAO PAULO', 'Corner Market')).toMatchObject({
			kind: 'contains',
			text: 'CORNERMKT'
		});
		expect(ruleDraft('SQ *BLUE BOTTLE 123', 'Blue Bottle')).toMatchObject({
			kind: 'contains',
			text: 'BLUE BOTTLE'
		});
		expect(ruleDraft('paypal *spotify', 'Spotify')).toMatchObject({
			kind: 'contains',
			text: 'spotify'
		});
		// A merchant's own name before the asterisk is kept.
		expect(ruleDraft('UBER *TRIP 8H2K', 'Uber')).toMatchObject({ kind: 'starts', text: 'UBER' });
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
