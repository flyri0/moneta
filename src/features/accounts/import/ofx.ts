import { DomainError } from '$domain/errors';
import { isDate } from '$domain/month';
import { parseStatementAmount } from './amount';
import { cleanText, withImportIds, type ParsedLine, type Statement } from './statement';

/** Whether `text` looks like an OFX (or QFX) file rather than a CSV. */
export function isOfx(text: string): boolean {
	return /OFXHEADER|<OFX>/i.test(text.slice(0, 2048));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescape(text: string): string {
	return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name]);
}

/**
 * The elements of an OFX body as a flat list: SGML (OFX 1.x) leaves the ends of values
 * unclosed and XML (OFX 2) closes them, so a value is whatever text follows its tag.
 */
function* tags(body: string): Generator<{ close: boolean; name: string; value: string }> {
	const re = /<(\/?)([A-Za-z0-9.]+)>([^<]*)/g;
	for (const m of body.matchAll(re)) {
		yield { close: m[1] === '/', name: m[2].toUpperCase(), value: unescape(m[3]).trim() };
	}
}

/** `20260105120000[-3:BRT]` → `2026-01-05`, or null. */
function ofxDate(value: string | undefined): string | null {
	const m = /^(\d{4})(\d{2})(\d{2})/.exec(value ?? '');
	if (!m) return null;
	const date = `${m[1]}-${m[2]}-${m[3]}`;
	return isDate(date) ? date : null;
}

/** OFX amounts use a dot, but some banks write a comma. */
function ofxAmount(value: string | undefined, digits: number): number | null {
	if (!value) return null;
	const decimal = /,\d{1,2}$/.test(value) || (value.includes(',') && !value.includes('.'));
	return parseStatementAmount(value, decimal ? ',' : '.', digits);
}

/**
 * Reads the transactions (`STMTTRN`) and ending balance (`LEDGERBAL`) of an OFX statement, in
 * `digits` decimal places. STATEMENT_UNREADABLE when it has a transaction that can't be read.
 */
export function parseOfx(text: string, digits: number): Statement {
	const start = text.search(/<OFX>/i);
	if (start < 0) throw new DomainError('STATEMENT_UNREADABLE', 'No <OFX> element');
	const lines: ParsedLine[] = [];
	let balance: Statement['balance'] = null;
	let current: Record<string, string> | null = null;
	let ledger: Record<string, string> | null = null;

	for (const tag of tags(text.slice(start))) {
		if (tag.name === 'STMTTRN') {
			if (!tag.close) current = {};
			else if (current) {
				lines.push(toLine(current, digits));
				current = null;
			}
		} else if (tag.name === 'LEDGERBAL') {
			if (!tag.close) ledger = {};
			else if (ledger) {
				balance = toBalance(ledger, digits);
				ledger = null;
			}
		} else if (!tag.close && tag.value) {
			const target = current ?? ledger;
			// A PAYEE aggregate's own NAME doesn't replace the transaction's.
			if (target && !(tag.name in target)) target[tag.name] = tag.value;
		}
	}
	// SGML may leave the last aggregate open at the end of the file.
	if (current) lines.push(toLine(current, digits));
	if (ledger) balance = toBalance(ledger, digits);
	return { lines: withImportIds(lines, 'ofx'), balance };
}

function toLine(fields: Record<string, string>, digits: number): ParsedLine {
	const date = ofxDate(fields.DTPOSTED ?? fields.DTUSER);
	const amount = ofxAmount(fields.TRNAMT, digits);
	if (date === null || amount === null)
		throw new DomainError('STATEMENT_UNREADABLE', 'A transaction has no readable date or amount');
	const name = cleanText(fields.NAME ?? '');
	const memo = cleanText(fields.MEMO ?? '');
	return {
		date,
		amount,
		description: name || memo,
		memo: name && memo !== name ? memo : '',
		bankId: fields.FITID ?? null
	};
}

function toBalance(fields: Record<string, string>, digits: number): Statement['balance'] {
	const amount = ofxAmount(fields.BALAMT, digits);
	const date = ofxDate(fields.DTASOF);
	return amount === null || date === null ? null : { amount, date };
}
