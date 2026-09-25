import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, passwordProblem, passwordStrength } from './backup-password';

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

describe('passwordStrength', () => {
	it('rates common passwords, in English or Portuguese, as easy to guess', async () => {
		expect(await passwordStrength('password1')).toBeLessThan(3);
		expect(await passwordStrength('senha123')).toBeLessThan(3);
	});

	it('rates a phrase of unrelated words as hard to guess', async () => {
		expect(await passwordStrength('violet lantern gravel orbit')).toBeGreaterThanOrEqual(3);
	});
});

describe('passwordProblem with a strength', () => {
	it('flags a password that is long enough but easy to guess', () => {
		expect(passwordProblem('password1', 'password1', 1)).toBe('weak');
		expect(passwordProblem('violet lantern gravel', 'violet lantern gravel', 4)).toBeNull();
	});

	it('flags a short password first, and waits for a strength before calling it weak', () => {
		expect(passwordProblem('short', 'short', 0)).toBe('short');
		expect(passwordProblem('password1', 'password1', null)).toBeNull();
	});
});
