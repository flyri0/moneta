import { describe, it, expect } from 'vitest';
import { isStartingBalance } from './payees';

describe('isStartingBalance', () => {
	it('matches the starting balance payee in either language, ignoring case and spaces', () => {
		expect(isStartingBalance('Starting Balance')).toBe(true);
		expect(isStartingBalance(' saldo inicial ')).toBe(true);
		expect(isStartingBalance('STARTING BALANCE')).toBe(true);
		expect(isStartingBalance('Starting')).toBe(false);
		expect(isStartingBalance('')).toBe(false);
		expect(isStartingBalance(null)).toBe(false);
		expect(isStartingBalance(undefined)).toBe(false);
	});
});
