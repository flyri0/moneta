import { describe, expect, it } from 'vitest';
import {
	applyFormat,
	guessFormat,
	localeDateOrder,
	parseCsv,
	parseCsvDate,
	storedFormat
} from './csv';

const fallback = { decimal: ',', dateOrder: 'DMY' } as const;

describe('parseCsv', () => {
	it('reads quoted fields, escaped quotes and CRLF, and drops blank rows', () => {
		expect(parseCsv('a,"b, c","say ""hi"""\r\n\r\n1,2,3\n')).toEqual([
			['a', 'b, c', 'say "hi"'],
			['1', '2', '3']
		]);
	});

	it('finds the delimiter', () => {
		expect(parseCsv('Data;Valor\n01/01/2026;1,50')).toEqual([
			['Data', 'Valor'],
			['01/01/2026', '1,50']
		]);
		expect(parseCsv('a\tb\n1\t2')).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('keeps line breaks inside quotes', () => {
		expect(parseCsv('"one\ntwo",3')).toEqual([['one\ntwo', '3']]);
	});
});

describe('parseCsvDate', () => {
	it('reads each order, short years and times', () => {
		expect(parseCsvDate('05/01/2026', 'DMY')).toBe('2026-01-05');
		expect(parseCsvDate('01/05/2026', 'MDY')).toBe('2026-01-05');
		expect(parseCsvDate('2026-01-05', 'YMD')).toBe('2026-01-05');
		expect(parseCsvDate('5.1.26', 'DMY')).toBe('2026-01-05');
		expect(parseCsvDate('2026-01-05T10:00:00', 'YMD')).toBe('2026-01-05');
		expect(parseCsvDate('05/01/2026 10:31', 'DMY')).toBe('2026-01-05');
	});

	it('refuses dates that do not exist or do not fit the order', () => {
		expect(parseCsvDate('31/02/2026', 'DMY')).toBeNull();
		expect(parseCsvDate('2026-01-05', 'DMY')).toBeNull();
		expect(parseCsvDate('hoje', 'DMY')).toBeNull();
	});
});

describe('guessFormat', () => {
	it('reads a Brazilian bank CSV from its header', () => {
		const table = parseCsv(
			'Data;Descrição;Valor;Saldo\n05/01/2026;PIX ENVIADO;-1.234,56;100,00\n13/01/2026;SALARIO;3.500,00;3.600,00'
		);
		expect(guessFormat(table, { decimal: '.', dateOrder: 'MDY' })).toEqual({
			header: true,
			date: 0,
			description: 1,
			memo: null,
			amount: 2,
			inflow: null,
			outflow: null,
			dateOrder: 'DMY',
			decimal: ',',
			invert: false
		});
	});

	it('reads a Nubank card CSV (date, title, amount)', () => {
		const table = parseCsv('date,title,amount\n2026-01-05,Padaria,12.50\n2026-01-06,Uber,30.1');
		expect(guessFormat(table, fallback)).toMatchObject({
			header: true,
			date: 0,
			description: 1,
			amount: 2,
			dateOrder: 'YMD',
			decimal: '.'
		});
	});

	it('finds separate credit and debit columns', () => {
		const table = parseCsv('Data,Histórico,Crédito,Débito\n05/01/2026,Loja,,10.00');
		expect(guessFormat(table, fallback)).toMatchObject({
			amount: null,
			inflow: 2,
			outflow: 3,
			description: 1
		});
	});

	it('reads the columns from their values without a header', () => {
		const table = parseCsv('Supermercado Bom,05/01/2026,-45.90\nPadaria,06/01/2026,-8.00');
		expect(guessFormat(table, fallback)).toMatchObject({
			header: false,
			date: 1,
			amount: 2,
			description: 0,
			decimal: '.'
		});
	});
});

describe('applyFormat', () => {
	const table = parseCsv(
		'Data;Descrição;Valor;Obs\n05/01/2026;PIX  ENVIADO;-1.234,56;Maria\n06/01/2026;TOTAL;;\n07/01/2026;Café;-5,00;'
	);
	const format = guessFormat(table, fallback);

	it('reads the lines and counts the ones it cannot', () => {
		const { lines, unreadable } = applyFormat(table, format, 2);
		expect(unreadable).toBe(1);
		expect(lines).toEqual([
			{
				date: '2026-01-05',
				amount: -123456,
				description: 'PIX ENVIADO',
				memo: 'Maria',
				importId: 'csv:2026-01-05:-123456:pix enviado:1'
			},
			{
				date: '2026-01-07',
				amount: -500,
				description: 'Café',
				memo: '',
				importId: 'csv:2026-01-07:-500:cafe:1'
			}
		]);
	});

	it('inverts the signs of card statements', () => {
		const { lines } = applyFormat(table, { ...format, invert: true }, 2);
		expect(lines.map((l) => l.amount)).toEqual([123456, 500]);
	});

	it('combines credit and debit columns', () => {
		const t = parseCsv('Data,Hist,Credito,Debito\n05/01/2026,A,100.00,\n06/01/2026,B,,-20.00');
		const { lines } = applyFormat(t, guessFormat(t, fallback), 2);
		expect(lines.map((l) => l.amount)).toEqual([10000, -2000]);
	});
});

describe('storedFormat', () => {
	const format = guessFormat(parseCsv('Data;Descrição;Valor\n05/01/2026;x;1,00'), fallback);

	it('returns a saved format that fits the table', () => {
		expect(storedFormat(JSON.stringify(format), 3)).toEqual(format);
	});

	it('ignores one that does not fit, or is not a format', () => {
		expect(storedFormat(JSON.stringify(format), 2)).toBeNull();
		expect(storedFormat('{"date":0}', 3)).toBeNull();
		expect(storedFormat('not json', 3)).toBeNull();
		expect(storedFormat(null, 3)).toBeNull();
	});
});

describe('localeDateOrder', () => {
	it('follows how the locale writes dates', () => {
		expect(localeDateOrder('pt-BR')).toBe('DMY');
		expect(localeDateOrder('en-US')).toBe('MDY');
		expect(localeDateOrder('sv-SE')).toBe('YMD');
	});
});
