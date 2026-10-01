import { describe, expect, it } from 'vitest';
import { neighbor } from './assigned-nav';

describe('neighbor', () => {
	const inputs = ['a', 'b', 'c'];

	it('gives the next and the previous input', () => {
		expect(neighbor(inputs, 'b', 1)).toBe('c');
		expect(neighbor(inputs, 'b', -1)).toBe('a');
	});

	it('stops at both ends instead of wrapping', () => {
		expect(neighbor(inputs, 'c', 1)).toBeUndefined();
		expect(neighbor(inputs, 'a', -1)).toBeUndefined();
	});

	it('gives nothing for an input that is not in the list', () => {
		expect(neighbor(inputs, 'z', 1)).toBeUndefined();
	});
});
