import { describe, expect, it } from 'vitest';
import { applyTone } from './skin-tone';

describe('applyTone', () => {
	it('leaves an emoji alone for tone 0', () => {
		expect(applyTone('👋', 0)).toBe('👋');
	});

	it('adds the modifier after a single person', () => {
		expect(applyTone('👋', 3)).toBe('👋🏽');
	});

	it('replaces the presentation selector', () => {
		expect(applyTone('🕵️', 1)).toBe('🕵🏻');
	});

	it('tones every person in a ZWJ sequence', () => {
		expect(applyTone('👩‍💻', 5)).toBe('👩🏿‍💻');
		expect(applyTone('👩‍❤️‍👨', 2)).toBe('👩🏼‍❤️‍👨🏼');
	});
});
