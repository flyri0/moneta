import { describe, expect, it } from 'vitest';
import { isOfx, parseOfx } from './ofx';

/** An OFX 1.02 statement the way Brazilian banks export it: SGML, unclosed values, commas. */
const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20260131120000[-3:BRT]<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKTRANLIST>
<DTSTART>20260101<DTEND>20260131
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260105120000[-3:BRT]
<TRNAMT>-45,90
<FITID>202601050001
<MEMO>COMPRA CARTAO   PADARIA  SAO JOAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260110
<TRNAMT>3500.00
<FITID>202601100002
<NAME>SALARIO &amp; BONUS
<MEMO>EMPRESA X
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1234,56<DTASOF>20260131</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260203</DTPOSTED><TRNAMT>-120.5</TRNAMT><FITID>a1</FITID><NAME>Mercado</NAME></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260204</DTPOSTED><TRNAMT>-10.00</TRNAMT><NAME>Café</NAME></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

describe('parseOfx', () => {
	it('reads an SGML statement, its balance and its ids', () => {
		expect(parseOfx(SGML, 2)).toEqual({
			lines: [
				{
					date: '2026-01-05',
					amount: -4590,
					description: 'COMPRA CARTAO PADARIA SAO JOAO',
					memo: '',
					importId: 'ofx:202601050001'
				},
				{
					date: '2026-01-10',
					amount: 350000,
					description: 'SALARIO & BONUS',
					memo: 'EMPRESA X',
					importId: 'ofx:202601100002'
				}
			],
			balance: { amount: 123456, date: '2026-01-31' }
		});
	});

	it('reads an XML statement, and makes up ids the bank left out', () => {
		const { lines, balance } = parseOfx(XML, 2);
		expect(lines.map((l) => [l.date, l.amount, l.description, l.importId])).toEqual([
			['2026-02-03', -12050, 'Mercado', 'ofx:a1'],
			['2026-02-04', -1000, 'Café', 'ofx:2026-02-04:-1000:cafe:1']
		]);
		expect(balance).toBeNull();
	});

	it('refuses a file with no OFX body or an unreadable transaction', () => {
		expect(() => parseOfx('Data;Valor', 2)).toThrow(
			expect.objectContaining({ code: 'STATEMENT_UNREADABLE' })
		);
		expect(() => parseOfx('<OFX><STMTTRN><TRNAMT>abc</STMTTRN></OFX>', 2)).toThrow(
			expect.objectContaining({ code: 'STATEMENT_UNREADABLE' })
		);
	});

	it('tells OFX files from CSV ones', () => {
		expect(isOfx(SGML)).toBe(true);
		expect(isOfx(XML)).toBe(true);
		expect(isOfx('Data;Descrição;Valor\n01/01/2026;x;1,00')).toBe(false);
	});

	it('refuses a file with the statements of several accounts', () => {
		const one = '<STMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20260105<TRNAMT>-1.00<FITID>1</STMTTRN>';
		const two =
			'<CCSTMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20260106<TRNAMT>-2.00<FITID>1</STMTTRN>';
		expect(() => parseOfx(`<OFX>${one}</STMTRS>${two}</CCSTMTRS></OFX>`, 2)).toThrow(
			expect.objectContaining({ code: 'STATEMENT_MULTIPLE_ACCOUNTS' })
		);
		expect(parseOfx(`<OFX>${one}</STMTRS></OFX>`, 2).lines).toHaveLength(1);
	});
});
