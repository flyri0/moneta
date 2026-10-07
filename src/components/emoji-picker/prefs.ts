import type { KeyValueStore } from '$client/registry';
import type { SkinTone } from './skin-tone';

/** This device's storage, or null where there is none (no browser, or blocked). */
export function deviceStore(): KeyValueStore | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/** Where this device keeps the emoji picked last, newest first. */
export const RECENT_EMOJI_KEY = 'moneta.recentEmoji';
/** Where this device keeps the picker's skin tone. */
export const SKIN_TONE_KEY = 'moneta.skinTone';
/** How many recent emoji the picker keeps: two rows. */
export const RECENT_LIMIT = 16;

export function readRecent(store: KeyValueStore | null): string[] {
	try {
		const raw: unknown = JSON.parse(store?.getItem(RECENT_EMOJI_KEY) ?? '[]');
		if (Array.isArray(raw))
			return raw.filter((e): e is string => typeof e === 'string').slice(0, RECENT_LIMIT);
	} catch {
		// Garbage or blocked storage: nothing recent.
	}
	return [];
}

/** Puts `emoji` first among the recent ones and returns the new list. */
export function addRecent(store: KeyValueStore | null, emoji: string): string[] {
	const next = [emoji, ...readRecent(store).filter((e) => e !== emoji)].slice(0, RECENT_LIMIT);
	try {
		store?.setItem(RECENT_EMOJI_KEY, JSON.stringify(next));
	} catch {
		// Storage can be full or blocked; the picker just forgets.
	}
	return next;
}

export function readTone(store: KeyValueStore | null): SkinTone {
	try {
		const tone = Number(store?.getItem(SKIN_TONE_KEY) ?? 0);
		if (Number.isInteger(tone) && tone >= 0 && tone <= 5) return tone as SkinTone;
	} catch {
		// Blocked storage: no tone.
	}
	return 0;
}

export function writeTone(store: KeyValueStore | null, tone: SkinTone): void {
	try {
		store?.setItem(SKIN_TONE_KEY, String(tone));
	} catch {
		// Storage can be full or blocked; the tone lasts until the page closes.
	}
}
