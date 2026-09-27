import type { StatementLine } from '$db/repos/imports';
import { foldText } from '$domain/search';

/** A statement line as a parser reads it, before it has an import id. */
export interface ParsedLine {
	date: string;
	amount: number;
	description: string;
	memo: string;
	/** The bank's own id for the line (OFX `FITID`), when it gives one. */
	bankId?: string | null;
}

/** A statement as read from a file: its lines, and the balance it ends with when it says. */
export interface Statement {
	lines: StatementLine[];
	balance: { amount: number; date: string } | null;
}

/** Trims a description and collapses its runs of spaces. */
export function cleanText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * Gives each line the id it is imported under: the bank's own when it has one, otherwise its
 * date, amount and description, numbered among identical lines. Importing an overlapping
 * statement again then finds the same ids.
 */
export function withImportIds(lines: ParsedLine[], prefix: 'ofx' | 'csv'): StatementLine[] {
	const seen = new Map<string, number>();
	return lines.map(({ bankId, ...line }) => {
		let importId: string;
		if (bankId) {
			importId = `${prefix}:${bankId}`;
		} else {
			const key = `${line.date}:${line.amount}:${foldText(line.description)}`;
			const n = (seen.get(key) ?? 0) + 1;
			seen.set(key, n);
			importId = `${prefix}:${key}:${n}`;
		}
		return { ...line, importId };
	});
}
