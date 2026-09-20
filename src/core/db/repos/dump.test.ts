import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../migrate';
import { createBudgetDb } from '../testing';
import { createAccount } from './accounts';
import { dumpBudget } from './dump';

describe('dumpBudget', () => {
	it('holds every table as plain JSON', async () => {
		const db = await createBudgetDb();
		createAccount(db, {
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 1000,
			startingDate: '2026-09-01'
		});
		const dump = dumpBudget(db, new Date('2026-09-19T12:00:00Z'));
		expect(dump).toMatchObject({
			format: 'moneta-budget',
			schemaVersion: SCHEMA_VERSION,
			exportedAt: '2026-09-19T12:00:00.000Z',
			meta: { name: 'Test Budget', currency: 'BRL', locale: 'pt-BR' }
		});
		expect(Object.keys(dump.tables).sort()).toEqual([
			'accounts',
			'budget_assignments',
			'categories',
			'category_groups',
			'payees',
			'transaction_splits',
			'transactions'
		]);
		expect(dump.tables.accounts).toEqual([expect.objectContaining({ name: 'Bank', on_budget: 1 })]);
		expect(dump.tables.transactions).toEqual([expect.objectContaining({ amount: 1000 })]);
		expect(JSON.parse(JSON.stringify(dump))).toEqual(dump);
	});
});
