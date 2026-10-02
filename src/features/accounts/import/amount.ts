/** A decimal separator in a bank's statement. */
export type DecimalSeparator = ',' | '.';

/** What may stand next to an amount: nothing, a symbol like `R$` or `US$`, or a code like `BRL`. */
const CURRENCY = /^(?:[A-Z]{3}|[A-Za-z]{0,2}[$€£¥₹]|)$/;

/** The longest cell, spaces left out, that can be an amount. */
const MAX_LENGTH = 64;

/**
 * Reads an amount from a statement into integer minor units: `1.234,56`, `-12.50`, `R$ 10,00`,
 * `(12.50)` and a trailing `D` (debit) or `C` (credit). Digits past the currency's are rounded
 * half away from zero, in decimal. Null for anything else.
 */
export function parseStatementAmount(
	text: string,
	decimal: DecimalSeparator,
	digits: number
): number | null {
	let s = text.replace(/[\s\u00a0]/g, '').replace(/[−–]/g, '-');
	// Nothing a bank writes is this long, and the affix pattern below backtracks on long text.
	if (s.length > MAX_LENGTH) return null;
	let negative = false;
	const suffix = /^(.*?)([DC])$/i.exec(s);
	if (suffix && /\d/.test(suffix[1])) {
		s = suffix[1];
		negative = suffix[2].toUpperCase() === 'D';
	}
	const parens = /^\((.*)\)$/.exec(s);
	if (parens) {
		s = parens[1];
		negative = true;
	}
	// A sign and a currency symbol or code may come before or after the number.
	const affixes = /^([^\d.,]*)(.*?)([^\d.,]*)$/.exec(s)!;
	const signs = (affixes[1] + affixes[3]).replace(/[^+-]/g, '');
	if (signs.length > 1) return null;
	if (signs === '-') negative = !negative;
	for (const affix of [affixes[1], affixes[3]]) {
		if (!CURRENCY.test(affix.replace(/[+-]/g, ''))) return null;
	}
	s = affixes[2];

	const group = decimal === ',' ? '.' : ',';
	const parts = s.split(decimal);
	if (parts.length > 2) return null;
	const [whole, fraction = ''] = parts;
	const grouped = new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`);
	if (!/^\d+$/.test(whole) && !grouped.test(whole)) return null;
	if (parts.length === 2 && !/^\d+$/.test(fraction)) return null;

	const intDigits = whole.split(group).join('');
	const kept = fraction.slice(0, digits).padEnd(digits, '0');
	let minor = BigInt(intDigits + kept);
	if (fraction.length > digits && Number(fraction[digits]) >= 5) minor += 1n;
	const value = Number(minor);
	if (!Number.isSafeInteger(value)) return null;
	return negative && value !== 0 ? -value : value;
}

/**
 * The decimal separator a column of amounts uses: the one followed by one or two digits at the
 * end of a value, by majority; `fallback` when no value tells (like `1.234` or `100`).
 */
export function detectDecimal(samples: string[], fallback: DecimalSeparator): DecimalSeparator {
	let comma = 0;
	let dot = 0;
	for (const sample of samples) {
		const m = /([.,])(\d{1,2})\D*$/.exec(sample.trim());
		if (!m) continue;
		if (m[1] === ',') comma++;
		else dot++;
	}
	if (comma === dot) return fallback;
	return comma > dot ? ',' : '.';
}
