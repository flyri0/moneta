import { describe, expect, it } from 'vitest';
import { visibleArea } from './visible-area';

describe('visibleArea', () => {
	it('is the visual viewport, which a phone keyboard shrinks and the browser may scroll', () => {
		const area = visibleArea({
			innerHeight: 844,
			visualViewport: { offsetTop: 120, height: 420 }
		});
		expect(area).toEqual({ top: 120, height: 420 });
	});

	it('is the whole window without a visual viewport', () => {
		expect(visibleArea({ innerHeight: 844, visualViewport: null })).toEqual({
			top: 0,
			height: 844
		});
	});
});
