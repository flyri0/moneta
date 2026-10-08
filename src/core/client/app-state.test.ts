import { afterEach, describe, it, expect } from 'vitest';
import type { BudgetMeta } from '$db/repos/meta';
import { BudgetSession } from './app-state.svelte';
import { MASK } from './hide-amounts';
import { amounts } from './hide-amounts.svelte';
import type { RpcClient } from './rpc';

const session = new BudgetSession({} as RpcClient, 'budget.sqlite3', {
	currency: 'USD',
	locale: 'en-US'
} as BudgetMeta);

describe('BudgetSession.format', () => {
	afterEach(() => {
		amounts.hidden = false;
	});

	it('formats amounts in the budget currency', () => {
		expect(session.format(123456)).toBe('$1,234.56');
		expect(session.formatCompact(123456)).not.toBe(MASK);
		expect(session.formatSigned(123456)).toBe('+$1,234.56');
	});

	it('masks every amount while amounts are hidden', () => {
		amounts.hidden = true;
		expect(session.format(123456)).toBe(MASK);
		expect(session.formatCompact(-5)).toBe(MASK);
		expect(session.formatSigned(5)).toBe(MASK);
	});
});
