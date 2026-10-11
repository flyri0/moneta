import { foldText } from '$domain/search';

/** Whether `query` names one of `items` exactly, by value or by label, ignoring case. */
export function hasExactMatch(items: { value: string; label: string }[], query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return false;
	return items.some((i) => i.value.toLowerCase() === q || i.label.toLowerCase() === q);
}
/** How well `text` matches `search` (both folded): 1 exact, 0.9 prefix, 0.8 word prefix, 0.6 inside. */
function score(text: string, search: string): number {
	if (text === search) return 1;
	if (text.startsWith(search)) return 0.9;
	if (text.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(search))) return 0.8;
	return text.includes(search) ? 0.6 : 0;
}

/**
 * The pickers' search: an item matches by its name (its `keywords`, else its `value`) when the
 * search is the name, starts it, starts one of its words, or appears in it. Case and accents are
 * ignored. Unlike the default fuzzy score, scattered letters never match: a name typed for a new
 * item leaves only the create row, so Enter creates it.
 */
export function pickerFilter(value: string, search: string, keywords?: string[]): number {
	const q = foldText(search.trim().toLowerCase());
	if (!q) return 1;
	const names = keywords && keywords.length > 0 ? keywords : [value];
	return Math.max(...names.map((name) => score(foldText(name.trim().toLowerCase()), q)));
}
