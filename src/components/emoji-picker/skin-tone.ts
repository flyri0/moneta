/** The five skin tone modifiers, light to dark. Tone 0 is none: the default yellow. */
export const SKIN_TONES = [
	'\u{1F3FB}',
	'\u{1F3FC}',
	'\u{1F3FD}',
	'\u{1F3FE}',
	'\u{1F3FF}'
] as const;

/** A skin tone: 0 for none, 1 (light) to 5 (dark). */
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * `emoji` with skin tone `tone` on every person in it: the modifier goes after each code point that
 * takes one, in place of its emoji presentation selector. Right for all but the exceptions the
 * generator lists (`TONE_EXCEPTIONS`).
 */
export function applyTone(emoji: string, tone: number): string {
	if (tone === 0) return emoji;
	const modifier = SKIN_TONES[tone - 1];
	return emoji.replace(/(\p{Emoji_Modifier_Base})\uFE0F?/gu, `$1${modifier}`);
}
