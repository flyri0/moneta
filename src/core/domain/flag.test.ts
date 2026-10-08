import { describe, expect, it } from 'vitest';
import { FLAG_COLORS, isFlagColor, validateFlag, validateFlagFilter } from './flag';

describe('flags', () => {
	it('are the six colors, in order', () => {
		expect(FLAG_COLORS).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);
	});

	it('knows a color', () => {
		expect(isFlagColor('blue')).toBe(true);
		expect(isFlagColor('none')).toBe(false);
		expect(isFlagColor(1)).toBe(false);
	});

	it('validates a flag, null for none', () => {
		expect(validateFlag('red')).toBe('red');
		expect(validateFlag(null)).toBeNull();
		expect(validateFlag(undefined)).toBeNull();
		expect(() => validateFlag('pink')).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
	});

	it('validates a filter of colors and none', () => {
		expect(validateFlagFilter(['red', 'none'])).toEqual(['red', 'none']);
		expect(() => validateFlagFilter(['pink'])).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(() => validateFlagFilter('red')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});
