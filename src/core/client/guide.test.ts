import { describe, expect, it } from 'vitest';
import { guidePath, guideTopicPath } from './guide';

describe('guidePath', () => {
	it('puts English at /guide/ and other languages under their code', () => {
		expect(guidePath('en')).toBe('/guide/');
		expect(guidePath('pt-BR')).toBe('/guide/pt-BR/');
		expect(guidePath('en', 'budgeting')).toBe('/guide/budgeting/');
		expect(guidePath('pt-BR', 'data', 'encryption')).toBe('/guide/pt-BR/data/#encryption');
	});

	it('falls back to English for a language the guide is not written in', () => {
		expect(guidePath('fr', 'faq')).toBe('/guide/faq/');
	});
});

describe('guideTopicPath', () => {
	it('links to the section of a topic', () => {
		expect(guideTopicPath('en', 'readyToAssign')).toBe('/guide/budgeting/#ready-to-assign');
		expect(guideTopicPath('pt-BR', 'googleDrive')).toBe('/guide/pt-BR/data/#google-drive');
	});
});
