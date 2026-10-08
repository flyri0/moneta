import { describe, it, expect } from 'vitest';
import { AMOUNT_TEXT, amountTone } from './amount';

describe('amountTone', () => {
	it('takes the tone from the sign alone', () => {
		expect(amountTone(1)).toBe('inflow');
		expect(amountTone(0)).toBe('zero');
		expect(amountTone(-1)).toBe('outflow');
	});

	it('colors only money in', () => {
		expect(AMOUNT_TEXT.inflow).toContain('emerald');
		expect(AMOUNT_TEXT.outflow).toBe('');
	});
});
