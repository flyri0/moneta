import { describe, expect, it } from 'vitest';
import { budgetName } from './budget-name';

describe('budgetName', () => {
	it('trims the name and refuses a blank one', () => {
		expect(budgetName('  Home ')).toBe('Home');
		expect(budgetName('   ')).toBeNull();
		expect(budgetName('')).toBeNull();
	});
});
