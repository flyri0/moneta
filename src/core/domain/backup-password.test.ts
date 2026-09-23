import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, passwordProblem } from './backup-password';

describe('passwordProblem', () => {
	it('accepts a long enough password typed the same twice', () => {
		expect(passwordProblem('correct horse', 'correct horse')).toBeNull();
		expect(
			passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH), 'a'.repeat(MIN_PASSWORD_LENGTH))
		).toBeNull();
	});

	it('flags a short password before a mismatch', () => {
		expect(passwordProblem('short', 'other')).toBe('short');
	});

	it('flags a confirmation that differs', () => {
		expect(passwordProblem('correct horse', 'correct house')).toBe('mismatch');
	});

	it('counts and compares accented letters however they were composed', () => {
		const nfc = 'açaí são'.normalize('NFC');
		const nfd = 'açaí são'.normalize('NFD');
		expect(passwordProblem(nfd, nfc)).toBeNull();
		expect(passwordProblem('ãããããããã'.normalize('NFD').slice(0, 9), 'x')).toBe('short');
	});
});
