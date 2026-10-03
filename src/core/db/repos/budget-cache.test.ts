import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import type { Db } from '../connection';
import { createAccount } from './accounts';
import { loadEngineInput } from './aggregates';
import { getBudgetMonth, setAssigned } from './budget';
import { createTransaction } from './transactions';

vi.mock('./aggregates', async (actual) => {
	const mod = await actual<typeof import('./aggregates')>();
	return { ...mod, loadEngineInput: vi.fn(mod.loadEngineInput) };
});

let db: Db;

beforeEach(async () => {
	db = await createBudgetDb();
	const bank = createAccount(db, {
		name: 'Bank',
		type: 'checking',
		onBudget: true,
		startingBalance: 100_000,
		startingDate: '2026-01-01'
	});
	createTransaction(db, {
		accountId: bank,
		date: '2026-02-03',
		amount: -2500,
		categoryId: categoryId(db, 'Food')
	});
	setAssigned(db, categoryId(db, 'Food'), '2026-01', 4000);
	vi.mocked(loadEngineInput).mockClear();
});

describe('the budget between writes', () => {
	it('loads the history once for any number of months', () => {
		for (const month of ['2026-01', '2026-02', '2026-03', '2026-01'] as const)
			getBudgetMonth(db, month);
		expect(loadEngineInput).toHaveBeenCalledTimes(1);
	});

	it('follows every write', () => {
		const food = () =>
			getBudgetMonth(db, '2026-02')
				.groups.flatMap((g) => g.categories)
				.find((c) => c.name === 'Food')!;
		expect(food().available).toBe(1500);
		setAssigned(db, categoryId(db, 'Food'), '2026-02', 1000);
		expect(food().available).toBe(2500);
		expect(loadEngineInput).toHaveBeenCalledTimes(2);
	});
});
