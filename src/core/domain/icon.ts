import { DomainError } from './errors';

/** Something drawn as an emoji: a pictograph, a flag's letters or a keycap. */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

let segmenter: Intl.Segmenter | undefined;

/**
 * Whether `text` is one emoji, ZWJ sequences, flags and skin tones included: one grapheme that is
 * drawn as an emoji. Unicode versions newer than the engine still count.
 */
export function isEmojiIcon(text: string): boolean {
	if (text.length === 0 || text.length > 32 || !EMOJI.test(text)) return false;
	segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
	const graphemes = segmenter.segment(text)[Symbol.iterator]();
	graphemes.next();
	return graphemes.next().done === true;
}

/** `icon` when it is one emoji (`isEmojiIcon`), null for none. Throws on anything else. */
export function validateIcon(icon: string | null): string | null {
	if (icon === null) return null;
	if (typeof icon !== 'string' || !isEmojiIcon(icon))
		throw new DomainError('INVALID_INPUT', 'An icon must be one emoji');
	return icon;
}
