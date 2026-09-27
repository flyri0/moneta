import { describe, expect, it } from 'vitest';
import { decodeStatement } from './decode';

const latin1 = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

describe('decodeStatement', () => {
	it('reads UTF-8 and drops its byte-order mark', () => {
		const bytes = new TextEncoder().encode('﻿Data;Descrição');
		expect(decodeStatement(bytes)).toBe('Data;Descrição');
	});

	it('falls back to Windows-1252 when the file is not UTF-8', () => {
		expect(decodeStatement(latin1('Descrição;Açougue'))).toBe('Descrição;Açougue');
	});

	it('follows the charset an OFX header names', () => {
		// "Ã©" is valid UTF-8 for "é", but the header says the file is Windows-1252.
		const text = 'OFXHEADER:100\nCHARSET:1252\n<MEMO>CafÃ©';
		expect(decodeStatement(latin1(text))).toBe(text);
	});
});
