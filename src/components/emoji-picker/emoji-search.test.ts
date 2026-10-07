import { describe, expect, it } from 'vitest';
import { EMOJI_GROUPS, TONE_EXCEPTIONS } from './emoji-data';
import { buildCatalog } from './emoji';
import { searchEmoji } from './emoji-search';
import en from './names/en';
import ptBR from './names/pt-BR';

const english = buildCatalog(EMOJI_GROUPS, TONE_EXCEPTIONS, en).all;
const portuguese = buildCatalog(EMOJI_GROUPS, TONE_EXCEPTIONS, ptBR).all;
const find = (query: string, emojis = english) => searchEmoji(emojis, query).map((e) => e.emoji);

describe('searchEmoji', () => {
	it('finds by name, the exact name first', () => {
		expect(find('pizza')[0]).toBe('🍕');
	});

	it('finds by keyword', () => {
		expect(find('cheese')).toContain('🍕');
	});

	it('needs every word, in any order', () => {
		expect(find('face cat')).toContain('🐱');
		expect(find('face cat')).not.toContain('😀');
	});

	it('ignores case, accents and punctuation', () => {
		expect(find('CORAÇÃO', portuguese)).toContain('❤️');
		expect(find('coracao', portuguese)).toContain('❤️');
		expect(find('flag: brazil')[0]).toBe('🇧🇷');
	});

	it('ranks a name that starts with the query before a keyword match', () => {
		const results = find('dog');
		expect(results.indexOf('🐶')).toBeLessThan(results.indexOf('🌭'));
	});

	it('finds a typed or pasted emoji, in any tone', () => {
		expect(find('🍕')[0]).toBe('🍕');
		expect(find('👍🏽')[0]).toBe('👍️');
	});

	it('finds nothing for an empty query or nonsense', () => {
		expect(find('   ')).toEqual([]);
		expect(find('zzqqxx')).toEqual([]);
	});
});
