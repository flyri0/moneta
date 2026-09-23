import { describe, it, expect } from 'vitest';
import { formatRecoveryKey, newRecoveryKey, parseRecoveryKey } from './recovery-key';

const BYTES = Uint8Array.from({ length: 20 }, (_, i) => i * 13);

describe('formatRecoveryKey', () => {
	it('writes 20 bytes as 8 groups of 4 Crockford base32 characters', () => {
		expect(formatRecoveryKey(new Uint8Array(20))).toBe('0000-0000-0000-0000-0000-0000-0000-0000');
		expect(formatRecoveryKey(new Uint8Array(20).fill(255))).toBe(
			'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ'
		);
	});

	it('rejects anything but 20 bytes', () => {
		expect(() => formatRecoveryKey(new Uint8Array(16))).toThrow();
	});
});

describe('parseRecoveryKey', () => {
	it('reads back what formatRecoveryKey wrote', () => {
		expect(parseRecoveryKey(formatRecoveryKey(BYTES))).toEqual(BYTES);
	});

	it('ignores case, spaces and dashes', () => {
		const text = formatRecoveryKey(BYTES);
		const loose = ` ${text.toLowerCase().replaceAll('-', ' ').replace(' ', '')} `;
		expect(parseRecoveryKey(loose)).toEqual(BYTES);
	});

	it('reads O as 0 and I or L as 1', () => {
		const zeros = parseRecoveryKey('0000-0000-0000-0000-0000-0000-0000-0001');
		expect(parseRecoveryKey('OOOO-oooo-0000-0000-0000-0000-0000-000I')).toEqual(zeros);
		expect(parseRecoveryKey('0000-0000-0000-0000-0000-0000-0000-000l')).toEqual(zeros);
	});

	it('rejects the wrong length or characters outside the alphabet', () => {
		expect(parseRecoveryKey('0000-0000')).toBeNull();
		expect(parseRecoveryKey('0000-0000-0000-0000-0000-0000-0000-00000')).toBeNull();
		expect(parseRecoveryKey('0000-0000-0000-0000-0000-0000-0000-000U')).toBeNull();
		expect(parseRecoveryKey('')).toBeNull();
	});
});

describe('newRecoveryKey', () => {
	it('makes a different key every time, in the recovery key format', () => {
		const a = newRecoveryKey();
		expect(a).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
		expect(newRecoveryKey()).not.toBe(a);
	});
});
