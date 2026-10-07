import { describe, expect, it, vi } from 'vitest';
import { buildCatalog, emojiKey, fold, loadCatalog, type EmojiGroupData } from './emoji';

const DATA: EmojiGroupData[] = [
	{
		id: 'smileys',
		emojis: [
			['😀', 1],
			['👋', 0.6, 1],
			['🫠', 14]
		]
	},
	{ id: 'food', emojis: [['🍕', 0.6]] }
];
const NAMES = 'grinning face\tsmile\nwaving hand\thello\nmelting face\nPizza\tcheese';

describe('fold', () => {
	it('drops case, accents and punctuation', () => {
		expect(fold('Coração: Vermelho!')).toBe('coracao vermelho');
	});
});

describe('emojiKey', () => {
	it('is the same for every tone and presentation of one emoji', () => {
		expect(emojiKey('👋🏽')).toBe(emojiKey('👋'));
		expect(emojiKey('🕵🏻')).toBe(emojiKey('🕵️'));
	});
});

describe('buildCatalog', () => {
	it('pairs each emoji with its line of names', () => {
		const catalog = buildCatalog(DATA, {}, NAMES);
		expect(catalog.groups.map((g) => g.emojis.map((e) => e.name))).toEqual([
			['grinning face', 'waving hand', 'melting face'],
			['Pizza']
		]);
		expect(catalog.find('🍕')?.search).toBe('pizza cheese');
	});

	it('leaves out emoji newer than the device shows, keeping the names aligned', () => {
		const catalog = buildCatalog(DATA, {}, NAMES, 13);
		expect(catalog.all.map((e) => e.emoji)).toEqual(['😀', '👋', '🍕']);
		expect(catalog.find('🍕')?.name).toBe('Pizza');
	});

	it('finds an emoji by any of its tones', () => {
		expect(buildCatalog(DATA, {}, NAMES).find('👋🏿')?.name).toBe('waving hand');
	});

	it('tones only the emoji that take one', () => {
		const catalog = buildCatalog(DATA, {}, NAMES);
		expect(catalog.tone(catalog.find('👋')!, 4)).toBe('👋🏾');
		expect(catalog.tone(catalog.find('🍕')!, 4)).toBe('🍕');
		expect(catalog.tone(catalog.find('👋')!, 0)).toBe('👋');
	});
});

describe('loadCatalog', () => {
	const sources = {
		data: { EMOJI_GROUPS: DATA, TONE_EXCEPTIONS: {}, VERSION_SAMPLES: [] },
		names: NAMES
	};

	it('loads once', async () => {
		const load = vi.fn().mockResolvedValue(sources);
		const first = await loadCatalog('test-once', load);
		expect(await loadCatalog('test-once', load)).toBe(first);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('tries again after a failed load', async () => {
		const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(sources);
		await expect(loadCatalog('test-retry', load)).rejects.toThrow('offline');
		const catalog = await loadCatalog('test-retry', load);
		expect(catalog.all.map((e) => e.emoji)).toContain('🍕');
	});
});
