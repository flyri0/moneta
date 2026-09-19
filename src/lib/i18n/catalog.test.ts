import { describe, it, expect } from 'vitest';
import en from './messages/en.json';
import pt from './messages/pt-BR.json';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogs', () => {
	it('have the same keys in every language', () => {
		expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
	});

	it('have no empty messages', () => {
		for (const catalog of [en, pt])
			for (const [key, text] of Object.entries(catalog)) expect(text.trim(), key).not.toBe('');
	});

	it('use the same placeholders in every language', () => {
		for (const [key, text] of Object.entries(en))
			expect(placeholders(pt[key as keyof typeof pt]), key).toEqual(placeholders(text));
	});
});
