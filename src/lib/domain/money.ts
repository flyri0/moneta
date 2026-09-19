export interface MoneyFormat {
	currency: string; // ISO 4217, e.g. 'BRL'
	locale: string; // BCP 47, e.g. 'pt-BR'
}

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

export function currencyDigits(currency: string): number {
	if (!SUPPORTED_CURRENCIES.has(currency)) throw new RangeError(`Unknown currency ${currency}`);
	return (
		new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

export function formatMoney(minor: number, fmt: MoneyFormat): string {
	const digits = currencyDigits(fmt.currency);
	return new Intl.NumberFormat(fmt.locale, { style: 'currency', currency: fmt.currency }).format(
		minor / 10 ** digits
	);
}

/** A short form for chart axes, e.g. "$1.2M" or "R$ 1,5 mil". */
export function formatMoneyCompact(minor: number, fmt: MoneyFormat): string {
	const digits = currencyDigits(fmt.currency);
	return new Intl.NumberFormat(fmt.locale, {
		style: 'currency',
		currency: fmt.currency,
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(minor / 10 ** digits);
}

/** The editable text for an amount: no currency symbol and no grouping, e.g. "1234,50" in pt-BR. */
export function formatAmountInput(minor: number, fmt: MoneyFormat): string {
	const digits = currencyDigits(fmt.currency);
	return new Intl.NumberFormat(fmt.locale, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
		useGrouping: false,
		numberingSystem: 'latn'
	})
		.format(minor / 10 ** digits)
		.replace('−', '-');
}

function decimalSeparator(locale: string): string {
	const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
	return part?.value ?? '.';
}

/**
 * Reads one number such as "1.234,56", "1,234.56", "12.5" or ".5".
 * - When both '.' and ',' appear, the last one is the decimal separator and the other groups thousands.
 * - A lone separator is decimal when it is the locale's decimal separator or is not followed by exactly 3 digits.
 * - A grouped integer part is 1–3 digits and then groups of exactly 3, all with the same separator.
 * - More decimals than the currency has are ambiguous ("1.234,567", "12.345" in USD) and rejected.
 */
function parseNumberToken(token: string, decimalSep: string, maxDecimals: number): number | null {
	if (/[.,]{2}|[.,]$/.test(token)) return null;
	const separators = token.replace(/\d/g, '');
	if (separators === '') return Number(token);
	const lastIndex = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
	const mixed = separators.includes('.') && separators.includes(',');
	const loneDecimal =
		separators.length === 1 &&
		(token[lastIndex] === decimalSep || token.length - lastIndex - 1 !== 3);
	const decimalIndex = mixed || loneDecimal ? lastIndex : -1;
	const intPart = decimalIndex === -1 ? token : token.slice(0, decimalIndex);
	const fraction = decimalIndex === -1 ? '' : token.slice(decimalIndex + 1);
	if (fraction.length > maxDecimals) return null;
	const groups = intPart.split(/[.,]/);
	if (groups.length > 1) {
		const groupSeparators = new Set(intPart.replace(/\d/g, ''));
		if (
			groupSeparators.size > 1 ||
			(decimalIndex !== -1 && groupSeparators.has(token[decimalIndex]))
		)
			return null;
		if (groups[0].length < 1 || groups[0].length > 3) return null;
		if (groups.slice(1).some((g) => g.length !== 3)) return null;
	}
	return Number(`${groups.join('') || '0'}.${fraction || '0'}`);
}

/** The strings that may stand for the budget currency in typed input, longest first. */
function currencySymbols(fmt: MoneyFormat): string[] {
	const symbols = new Set([fmt.currency]);
	for (const currencyDisplay of ['symbol', 'narrowSymbol'] as const) {
		const part = new Intl.NumberFormat(fmt.locale, {
			style: 'currency',
			currency: fmt.currency,
			currencyDisplay
		})
			.formatToParts(1)
			.find((p) => p.type === 'currency');
		if (part) symbols.add(part.value);
	}
	return [...symbols].sort((a, b) => b.length - a.length);
}

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

function tokenize(input: string, decimalSep: string, maxDecimals: number): Token[] | null {
	const tokens: Token[] = [];
	const re = /\s*(?:([\d.,]+)|([-+*/()]))/y;
	let pos = 0;
	if (/[^\d.,+\-*/()\s]/.test(input)) return null; // letters and other symbols are typos
	const trimmed = input.trim();
	while (pos < trimmed.length) {
		re.lastIndex = pos;
		const m = re.exec(trimmed);
		if (!m) return null;
		if (m[1] !== undefined) {
			const value = parseNumberToken(m[1], decimalSep, maxDecimals);
			if (value === null) return null;
			tokens.push({ kind: 'num', value });
		} else {
			tokens.push({ kind: 'op', value: m[2] });
		}
		pos = re.lastIndex;
	}
	return tokens;
}

// Grammar: expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ;
// factor := ('-'|'+') factor | number | '(' expr ')'
function evaluate(tokens: Token[]): number | null {
	let i = 0;
	const peek = () => tokens[i];
	const isOp = (v: string) => peek()?.kind === 'op' && peek()!.value === v;

	function factor(): number | null {
		if (isOp('-')) {
			i++;
			const v = factor();
			return v === null ? null : -v;
		}
		if (isOp('+')) {
			i++;
			return factor();
		}
		if (isOp('(')) {
			i++;
			const v = expr();
			if (!isOp(')')) return null;
			i++;
			return v;
		}
		const t = peek();
		if (t?.kind === 'num') {
			i++;
			return t.value;
		}
		return null;
	}

	function term(): number | null {
		let left = factor();
		while (left !== null && (isOp('*') || isOp('/'))) {
			const op = tokens[i++].value;
			const right = factor();
			if (right === null) return null;
			if (op === '/' && right === 0) return null;
			left = op === '*' ? left * right : left / right;
		}
		return left;
	}

	function expr(): number | null {
		let left = term();
		while (left !== null && (isOp('+') || isOp('-'))) {
			const op = tokens[i++].value;
			const right = term();
			if (right === null) return null;
			left = op === '+' ? left + right : left - right;
		}
		return left;
	}

	const result = expr();
	return i === tokens.length ? result : null;
}

/**
 * Parses user input like "1.234,56", "R$ 12,50" or "120+35" into integer minor units.
 * Returns null for anything ambiguous or malformed rather than guessing.
 */
export function parseAmount(input: string, fmt: MoneyFormat): number | null {
	let text = input.replace(/−/g, '-'); // some locales format negatives with U+2212
	for (const symbol of currencySymbols(fmt)) text = text.split(symbol).join(' ');
	const digits = currencyDigits(fmt.currency);
	const tokens = tokenize(text, decimalSeparator(fmt.locale), digits);
	if (!tokens || tokens.length === 0) return null;
	const value = evaluate(tokens);
	if (value === null || !Number.isFinite(value)) return null;
	const scaled = value * 10 ** digits;
	const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
	return rounded === 0 ? 0 : rounded;
}
