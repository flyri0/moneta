export interface MoneyFormat {
	currency: string; // ISO 4217, e.g. 'BRL'
	locale: string; // BCP 47, e.g. 'pt-BR'
}

export function currencyDigits(currency: string): number {
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

function decimalSeparator(locale: string): string {
	const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
	return part?.value ?? '.';
}

// A '.' or ',' is a decimal separator when it is the locale's decimal separator,
// or when it is the last separator and is not followed by exactly 3 digits.
function parseNumberToken(token: string, decimalSep: string): number | null {
	if (/[.,]{2}|[.,]$/.test(token)) return null;
	const last = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
	if (last === -1) return Number(token);
	const digitsAfter = token.length - last - 1;
	const isDecimal = token[last] === decimalSep || digitsAfter !== 3;
	let normalized: string;
	if (isDecimal) {
		const intPart = token.slice(0, last).replace(/[.,]/g, '');
		normalized = `${intPart || '0'}.${token.slice(last + 1)}`;
	} else {
		normalized = token.replace(/[.,]/g, '');
	}
	const value = Number(normalized);
	return Number.isFinite(value) ? value : null;
}

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

function tokenize(input: string, decimalSep: string): Token[] | null {
	const tokens: Token[] = [];
	const re = /\s*(?:([\d.,]+)|([-+*/()]))/y;
	let pos = 0;
	const trimmed = input.replace(/[^\d.,+\-*/()\s]/g, '').trim();
	while (pos < trimmed.length) {
		re.lastIndex = pos;
		const m = re.exec(trimmed);
		if (!m) return null;
		if (m[1] !== undefined) {
			const value = parseNumberToken(m[1], decimalSep);
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

/** Parses user input like "1.234,56", "12.50" or "120+35" into integer minor units. */
export function parseAmount(input: string, fmt: MoneyFormat): number | null {
	const tokens = tokenize(input, decimalSeparator(fmt.locale));
	if (!tokens || tokens.length === 0) return null;
	const value = evaluate(tokens);
	if (value === null || !Number.isFinite(value)) return null;
	const scaled = value * 10 ** currencyDigits(fmt.currency);
	const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
	return rounded === 0 ? 0 : rounded;
}
