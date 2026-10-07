import { emojiKey, fold, type PickerEmoji } from './emoji';

/**
 * The emoji whose name or keywords hold every word of `query`, best first: the name itself, a
 * name that starts with it, a name word that does, a keyword that does, then the rest, each in
 * Unicode's order. Typing or pasting an emoji finds it too.
 */
export function searchEmoji(emojis: readonly PickerEmoji[], query: string): PickerEmoji[] {
	const key = emojiKey(query.trim());
	const exact = key ? emojis.filter((e) => emojiKey(e.emoji) === key) : [];
	const folded = fold(query);
	const words = folded.split(' ').filter(Boolean);
	if (words.length === 0) return exact;

	const scored: { emoji: PickerEmoji; score: number }[] = [];
	for (const emoji of emojis) {
		if (!words.every((w) => emoji.search.includes(w))) continue;
		scored.push({ emoji, score: score(emoji, folded, words[0]) });
	}
	scored.sort((a, b) => a.score - b.score);
	const found = scored.map((s) => s.emoji);
	return exact.length > 0 ? [...exact, ...found.filter((e) => !exact.includes(e))] : found;
}

function score(emoji: PickerEmoji, query: string, first: string): number {
	const name = fold(emoji.name);
	if (name === query) return 0;
	if (name.startsWith(query)) return 1;
	if (` ${name}`.includes(` ${first}`)) return 2;
	if (` ${emoji.search}`.includes(` ${first}`)) return 3;
	return 4;
}
