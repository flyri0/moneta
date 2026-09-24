import { parseAmount, type MoneyFormat } from './money';

/** A search term: its folded text, and the amount (absolute, in minor units) it reads as, if any. */
export interface SearchTerm {
	text: string;
	amount: number | null;
}

const MAX_TERMS = 8;
const NEEDS_FOLDING = /[A-Z\u0080-\uffff]/;
const MARKS = /\p{M}/gu;

/** Lowercases `text` and drops its accents, so "Açougue" and "acougue" compare equal. */
export function foldText(text: string): string {
	if (!NEEDS_FOLDING.test(text)) return text;
	return text.normalize('NFD').replace(MARKS, '').toLowerCase();
}

/**
 * Splits a search into folded terms (at most eight, without repeats). A term that reads as an
 * amount in the budget's format also carries that amount, without its sign.
 */
export function searchTerms(search: string, fmt: MoneyFormat): SearchTerm[] {
	const terms: SearchTerm[] = [];
	for (const word of search.split(/\s+/)) {
		if (terms.length === MAX_TERMS) break;
		const text = foldText(word);
		if (!text || terms.some((t) => t.text === text)) continue;
		const amount = /\d/.test(word) ? parseAmount(word, fmt) : null;
		terms.push({ text, amount: amount === null ? null : Math.abs(amount) });
	}
	return terms;
}
