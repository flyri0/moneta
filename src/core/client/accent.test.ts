import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ACCENTS, ACCENT_SWATCH, DEFAULT_ACCENT, isAccent, readAccent } from './accent';

describe('the accent list', () => {
	it('has no duplicates and contains the default', () => {
		expect(new Set(ACCENTS).size).toBe(ACCENTS.length);
		expect(ACCENTS).toContain(DEFAULT_ACCENT);
	});

	it('gives every accent a swatch coloured from its own palette in both modes', () => {
		for (const accent of ACCENTS) {
			expect(ACCENT_SWATCH[accent], accent).toMatch(new RegExp(`(^| )bg-${accent}-\\d+( |$)`));
			expect(ACCENT_SWATCH[accent], accent).toMatch(new RegExp(`(^| )dark:bg-${accent}-\\d+( |$)`));
		}
	});
});

describe('isAccent', () => {
	it('accepts every listed accent', () => {
		for (const accent of ACCENTS) expect(isAccent(accent)).toBe(true);
	});

	it('rejects anything else, including an empty or missing value', () => {
		expect(isAccent('')).toBe(false);
		expect(isAccent('chartreuse')).toBe(false);
		expect(isAccent('Blue')).toBe(false);
		expect(isAccent(null)).toBe(false);
		expect(isAccent(undefined)).toBe(false);
	});
});

describe('readAccent', () => {
	it('keeps a stored accent', () => {
		expect(readAccent('violet')).toBe('violet');
	});

	it('falls back to the default for an empty, unknown or missing value', () => {
		expect(readAccent('')).toBe(DEFAULT_ACCENT);
		expect(readAccent('chartreuse')).toBe(DEFAULT_ACCENT);
		expect(readAccent(null)).toBe(DEFAULT_ACCENT);
	});
});

describe('the stylesheet', () => {
	const css = readFileSync(new URL('../../routes/layout.css', import.meta.url), 'utf8');

	it('defines a light and a dark block for every accent', () => {
		for (const accent of ACCENTS) {
			expect(css, accent).toContain(`[data-theme='${accent}'] {`);
			expect(css, accent).toContain(`.dark[data-theme='${accent}'] {`);
		}
	});

	it('defines no accent block for a colour that is not listed', () => {
		const declared = [...css.matchAll(/\[data-theme='([a-z]+)'\]/g)].map((match) => match[1]);
		expect(declared.length).toBeGreaterThan(0);
		expect([...new Set(declared)].sort()).toEqual([...ACCENTS].sort());
	});
});
