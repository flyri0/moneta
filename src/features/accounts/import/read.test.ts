import { describe, expect, it } from 'vitest';
import { readStatement } from './read';

const bytes = (text: string) => new TextEncoder().encode(text);
const code = (c: string) => expect.objectContaining({ code: c });

describe('readStatement', () => {
	it('reads an OFX file into lines', () => {
		const read = readStatement(
			bytes('<OFX><STMTTRN><DTPOSTED>20260105<TRNAMT>-1.00<FITID>1</STMTTRN></OFX>'),
			2
		);
		expect(read).toMatchObject({ kind: 'ofx', statement: { lines: [{ amount: -100 }] } });
	});

	it('reads a table too long to spread into arguments', () => {
		const rows = Array.from({ length: 300_000 }, () => 'a;b').join('\n');
		const read = readStatement(bytes(rows), 2);
		expect(read).toMatchObject({ kind: 'csv' });
	});

	it('reads anything else as a CSV table', () => {
		expect(readStatement(bytes('Data;Valor\n05/01/2026;1,00'), 2)).toEqual({
			kind: 'csv',
			table: [
				['Data', 'Valor'],
				['05/01/2026', '1,00']
			]
		});
	});

	it('refuses empty statements and files that are not tables', () => {
		expect(() => readStatement(bytes('<OFX></OFX>'), 2)).toThrow(code('STATEMENT_EMPTY'));
		expect(() => readStatement(bytes('\n\n'), 2)).toThrow(code('STATEMENT_EMPTY'));
		expect(() => readStatement(bytes('just some text'), 2)).toThrow(code('STATEMENT_UNREADABLE'));
		expect(() => readStatement(Uint8Array.of(0x50, 0x4b, 0, 0, 1, 2), 2)).toThrow(
			code('STATEMENT_UNREADABLE')
		);
	});
});
