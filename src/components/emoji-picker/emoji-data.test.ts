import { describe, expect, it } from 'vitest';
import { EMOJI_GROUPS, TONE_EXCEPTIONS } from './emoji-data';
import { isEmojiIcon } from '$domain/icon';
import { buildCatalog } from './emoji';
import en from './names/en';
import ptBR from './names/pt-BR';

const count = EMOJI_GROUPS.reduce((n, g) => n + g.emojis.length, 0);

describe('the generated data', () => {
	it('has every group, each with emoji', () => {
		expect(EMOJI_GROUPS.map((g) => g.id)).toEqual([
			'smileys',
			'animals',
			'food',
			'activities',
			'travel',
			'objects',
			'symbols',
			'flags'
		]);
		for (const group of EMOJI_GROUPS) expect(group.emojis.length).toBeGreaterThan(0);
	});

	it('is the full set, not a sample', () => {
		expect(count).toBeGreaterThan(1800);
	});

	it('has one line of names per emoji in each locale', () => {
		expect(en.split('\n')).toHaveLength(count);
		expect(ptBR.split('\n')).toHaveLength(count);
	});

	it('has each emoji once', () => {
		const all = EMOJI_GROUPS.flatMap((g) => g.emojis.map(([e]) => e));
		expect(new Set(all).size).toBe(all.length);
	});

	it('has ZWJ sequences, keycaps, country and subdivision flags', () => {
		const catalog = buildCatalog(EMOJI_GROUPS, TONE_EXCEPTIONS, en);
		expect(catalog.find('🏳️‍🌈')?.name).toBe('rainbow flag');
		expect(catalog.find('🇧🇷')?.name).toBe('flag: Brazil');
		expect(catalog.find('🏴󠁧󠁢󠁳󠁣󠁴󠁿')?.name).toBe('flag: Scotland');
		expect(catalog.find('#️⃣')?.name).toBe('keycap: #');
		expect(catalog.find('🧑‍💻')?.skin).toBe(true);
	});

	it('can store every emoji in every skin tone as an icon', () => {
		const catalog = buildCatalog(EMOJI_GROUPS, TONE_EXCEPTIONS, en);
		const refused = catalog.all.flatMap((e) =>
			([0, 1, 2, 3, 4, 5] as const)
				.map((tone) => catalog.tone(e, tone))
				.filter((text) => !isEmojiIcon(text))
		);
		expect(refused).toEqual([]);
	});

	it('names the emoji in Portuguese', () => {
		const catalog = buildCatalog(EMOJI_GROUPS, TONE_EXCEPTIONS, ptBR);
		expect(catalog.find('🍕')?.name).toBe('pizza');
		expect(catalog.find('🐶')?.name).toBe('rosto de cachorro');
	});

	it('tones the exceptions from their own list', () => {
		const catalog = buildCatalog(EMOJI_GROUPS, TONE_EXCEPTIONS, en);
		expect(catalog.tone(catalog.find('🧑‍🤝‍🧑')!, 3)).toBe('🧑🏽‍🤝‍🧑🏽');
	});
});
