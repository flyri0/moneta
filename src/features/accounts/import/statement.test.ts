import { describe, expect, it } from 'vitest';
import { cleanText, withImportIds } from './statement';

describe('withImportIds', () => {
	const line = { date: '2026-01-05', amount: -1000, description: 'Padaria São João', memo: '' };

	it("uses the bank's id when there is one", () => {
		expect(withImportIds([{ ...line, bankId: 'ABC1' }], 'ofx')[0].importId).toBe('ofx:ABC1');
	});

	it('numbers identical lines, folding the description', () => {
		const ids = withImportIds(
			[line, { ...line, description: 'PADARIA SAO JOAO' }, { ...line, amount: -2000 }],
			'csv'
		).map((l) => l.importId);
		expect(ids).toEqual([
			'csv:2026-01-05:-1000:padaria sao joao:1',
			'csv:2026-01-05:-1000:padaria sao joao:2',
			'csv:2026-01-05:-2000:padaria sao joao:1'
		]);
	});

	it('keeps the line without its bank id', () => {
		expect(withImportIds([{ ...line, bankId: 'X' }], 'ofx')[0]).toEqual({
			...line,
			importId: 'ofx:X'
		});
	});
});

describe('cleanText', () => {
	it('trims and collapses spaces', () => {
		expect(cleanText('  PIX   ENVIADO\t Maria ')).toBe('PIX ENVIADO Maria');
	});
});
