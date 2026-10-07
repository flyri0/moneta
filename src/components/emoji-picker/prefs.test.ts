import { describe, expect, it } from 'vitest';
import { memoryStore } from '$client/testing';
import {
	addRecent,
	readRecent,
	readTone,
	RECENT_EMOJI_KEY,
	RECENT_LIMIT,
	SKIN_TONE_KEY,
	writeTone
} from './prefs';

describe('recent emoji', () => {
	it('starts empty', () => {
		expect(readRecent(memoryStore())).toEqual([]);
	});

	it('puts the latest first, once', () => {
		const store = memoryStore();
		addRecent(store, '🍕');
		addRecent(store, '🚗');
		expect(addRecent(store, '🍕')).toEqual(['🍕', '🚗']);
		expect(readRecent(store)).toEqual(['🍕', '🚗']);
	});

	it(`keeps the last ${RECENT_LIMIT}`, () => {
		const store = memoryStore();
		for (let i = 0; i < RECENT_LIMIT + 4; i++) addRecent(store, String(i));
		expect(readRecent(store)).toHaveLength(RECENT_LIMIT);
	});

	it('ignores garbage', () => {
		const store = memoryStore();
		store.setItem(RECENT_EMOJI_KEY, '{nope');
		expect(readRecent(store)).toEqual([]);
		store.setItem(RECENT_EMOJI_KEY, '["🍕", 3]');
		expect(readRecent(store)).toEqual(['🍕']);
	});

	it('drops repeats, which would break the list', () => {
		const store = memoryStore();
		store.setItem(RECENT_EMOJI_KEY, '["🍕", "🚗", "🍕"]');
		expect(readRecent(store)).toEqual(['🍕', '🚗']);
	});
});

describe('skin tone', () => {
	it('defaults to none and remembers the choice', () => {
		const store = memoryStore();
		expect(readTone(store)).toBe(0);
		writeTone(store, 4);
		expect(readTone(store)).toBe(4);
	});

	it('ignores garbage', () => {
		const store = memoryStore();
		store.setItem(SKIN_TONE_KEY, '9');
		expect(readTone(store)).toBe(0);
	});
});
