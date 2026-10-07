import { describe, expect, it } from 'vitest';
import { isEmojiIcon, validateIcon } from './icon';

describe('isEmojiIcon', () => {
	it('takes one emoji of any kind', () => {
		for (const emoji of ['🍕', '☺️', '👋🏽', '👩🏿‍💻', '🧑🏽‍🤝‍🧑🏽', '🏳️‍🌈', '🇧🇷', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '#️⃣', '❤️‍🔥'])
			expect(isEmojiIcon(emoji), emoji).toBe(true);
	});

	it('refuses text, several emoji and nothing', () => {
		for (const text of ['', 'a', 'pizza', '🍕🍕', '🍕 ', '1', ' '])
			expect(isEmojiIcon(text), text).toBe(false);
	});
});

describe('validateIcon', () => {
	it('keeps an emoji and null', () => {
		expect(validateIcon('🍕')).toBe('🍕');
		expect(validateIcon(null)).toBeNull();
	});

	it('throws on anything else', () => {
		expect(() => validateIcon('abc')).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
	});
});
