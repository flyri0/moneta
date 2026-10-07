import { applyTone, type SkinTone } from './skin-tone';

/** The picker's groups, in the order of its tabs. */
export type EmojiGroupId =
	'smileys' | 'animals' | 'food' | 'activities' | 'travel' | 'objects' | 'symbols' | 'flags';

/** An emoji in the generated data: the sequence, its Emoji version, and 1 when it takes a skin tone. */
export type EmojiEntry = readonly [emoji: string, version: number, skin?: 1];

export interface EmojiGroupData {
	id: EmojiGroupId;
	emojis: readonly EmojiEntry[];
}

/** An emoji as the picker shows it. */
export interface PickerEmoji {
	/** The fully qualified sequence, without a skin tone. */
	emoji: string;
	name: string;
	/** Whether it takes a skin tone. */
	skin: boolean;
	/** Its name and keywords, folded for search (`fold`). */
	search: string;
}

export interface EmojiCatalog {
	groups: { id: EmojiGroupId; emojis: PickerEmoji[] }[];
	/** Every emoji, in group order. */
	all: PickerEmoji[];
	/** The emoji `text` is, in any skin tone (`emojiKey`), when there is one. */
	find(text: string): PickerEmoji | undefined;
	/** `emoji` in skin `tone`, when it takes one. */
	tone(emoji: PickerEmoji, tone: SkinTone): string;
}

/** Lowercase, without accents or punctuation: what search compares. */
export function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/** `text` without skin tones or presentation selectors: the same for every form of one emoji. */
export function emojiKey(text: string): string {
	return text.replace(/\uFE0E|\uFE0F|\p{Emoji_Modifier}/gu, '');
}

/**
 * Builds the catalog from the generated data and one locale's names, leaving out the emoji newer
 * than `maxVersion`.
 */
export function buildCatalog(
	data: readonly EmojiGroupData[],
	exceptions: Readonly<Record<string, readonly string[]>>,
	names: string,
	maxVersion = Infinity
): EmojiCatalog {
	const lines = names.split('\n');
	let index = 0;
	const groups = data.map((group) => {
		const emojis: PickerEmoji[] = [];
		for (const [emoji, version, skin] of group.emojis) {
			const [name = '', keywords = ''] = (lines[index++] ?? '').split('\t');
			if (version > maxVersion) continue;
			emojis.push({ emoji, name, skin: skin === 1, search: fold(`${name} ${keywords}`) });
		}
		return { id: group.id, emojis };
	});
	const all = groups.flatMap((g) => g.emojis);
	const byKey = new Map(all.map((e) => [emojiKey(e.emoji), e]));
	return {
		groups,
		all,
		find: (text) => byKey.get(emojiKey(text)),
		tone(emoji, tone) {
			if (!emoji.skin || tone === 0) return emoji.emoji;
			return exceptions[emoji.emoji]?.[tone - 1] ?? applyTone(emoji.emoji, tone);
		}
	};
}

/** What a catalog is built from: the generated data and one locale's names. */
export interface CatalogSources {
	data: Pick<typeof import('./emoji-data'), 'EMOJI_GROUPS' | 'TONE_EXCEPTIONS' | 'VERSION_SAMPLES'>;
	names: string;
}

/** Fetches the data and the names in `locale` (English when it has none of its own). */
async function importSources(locale: string): Promise<CatalogSources> {
	const [data, names] = await Promise.all([
		import('./emoji-data'),
		locale === 'pt-BR' ? import('./names/pt-BR') : import('./names/en')
	]);
	return { data, names: names.default };
}

const catalogs = new Map<string, Promise<EmojiCatalog>>();

/**
 * The catalog in `locale`, with only the emoji this device can show. Loaded once: the data is its
 * own chunk, fetched the first time a picker opens. A failed load is forgotten, so the next picker
 * tries again.
 */
export function loadCatalog(
	locale: string,
	load: (locale: string) => Promise<CatalogSources> = importSources
): Promise<EmojiCatalog> {
	let catalog = catalogs.get(locale);
	if (!catalog) {
		catalog = load(locale).then(({ data, names }) =>
			buildCatalog(
				data.EMOJI_GROUPS,
				data.TONE_EXCEPTIONS,
				names,
				supportedVersion(data.VERSION_SAMPLES)
			)
		);
		catalogs.set(locale, catalog);
		catalog.catch(() => {
			if (catalogs.get(locale) === catalog) catalogs.delete(locale);
		});
	}
	return catalog;
}

let supported: number | undefined;

/**
 * The newest Emoji version this device draws, from one sample of each: a color glyph no wider than
 * one emoji. Newer ones would show as boxes or as their parts side by side. Everything when it
 * can't tell (no canvas, or no color emoji font at all).
 */
function supportedVersion(samples: readonly (readonly [number, string])[]): number {
	if (supported !== undefined) return supported;
	supported = Infinity;
	if (typeof document === 'undefined') return supported;
	const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!ctx) return supported;
	const size = 20;
	ctx.canvas.width = ctx.canvas.height = size * 2;
	ctx.font = `${size}px sans-serif`;
	ctx.textBaseline = 'top';
	const width = ctx.measureText('\u{1F600}').width;
	let newest = -1;
	for (const [version, sample] of samples) {
		if (drawsAsOne(ctx, sample, width, size)) newest = version;
	}
	if (newest >= 1) supported = newest;
	return supported;
}

function drawsAsOne(
	ctx: CanvasRenderingContext2D,
	emoji: string,
	width: number,
	size: number
): boolean {
	if (ctx.measureText(emoji).width > width * 1.5) return false;
	ctx.clearRect(0, 0, size * 2, size * 2);
	ctx.fillStyle = 'black';
	ctx.fillText(emoji, 0, 0);
	const pixels = ctx.getImageData(0, 0, size * 2, size * 2).data;
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i + 3] > 0 && (pixels[i] !== pixels[i + 1] || pixels[i + 1] !== pixels[i + 2]))
			return true;
	}
	return false;
}
