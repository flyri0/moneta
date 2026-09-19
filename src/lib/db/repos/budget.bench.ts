import { bench, describe } from 'vitest';
import { computeBudget } from '$lib/domain/budget-engine';
import { addMonths, monthRange } from '$lib/domain/month';
import { createBudgetDb } from '../testing';
import { run, tx, type Db } from '../connection';
import { createAccount } from './accounts';
import { loadEngineInput } from './aggregates';
import { createCategory, createGroup } from './categories';
import { getBudgetMonth, setAssigned } from './budget';
import { readyToAssignCategoryId } from './meta';
import { createTransaction } from './transactions';

const YEARS = 5;
const CATEGORIES = 40;
const SPENDING_PER_MONTH = 150;
const LAST = '2026-09';

/**
 * A heavy personal budget: 5 years, 40 categories, a checking account and a card,
 * 150 purchases a month (about 9,000 transactions) and an assignment per category and month.
 */
async function bigBudget(): Promise<Db> {
	const db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2021-10-01' };
	const bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	const card = createAccount(db, { ...base, name: 'Card', type: 'credit_card' });
	const group = createGroup(db, { name: 'Bench' });
	const categories = Array.from({ length: CATEGORIES }, (_, i) =>
		createCategory(db, { groupId: group, name: `Category ${i + 1}` })
	);
	const income = readyToAssignCategoryId(db);
	tx(db, () => {
		for (const month of monthRange(addMonths(LAST, -12 * YEARS + 1), LAST)) {
			createTransaction(db, {
				accountId: bank,
				date: `${month}-01`,
				amount: 1_000_000,
				categoryId: income
			});
			categories.forEach((id) => setAssigned(db, id, month, 20_000));
			for (let i = 0; i < SPENDING_PER_MONTH; i++) {
				createTransaction(db, {
					accountId: i % 3 === 0 ? card : bank,
					date: `${month}-${String((i % 28) + 1).padStart(2, '0')}`,
					amount: -(1_000 + ((i * 37) % 5_000)),
					categoryId: categories[i % CATEGORIES]
				});
			}
		}
	});
	run(db, 'ANALYZE');
	return db;
}

const db = await bigBudget();
const input = loadEngineInput(db);

describe('budget recompute', () => {
	bench('getBudgetMonth, 5 years of history', () => {
		getBudgetMonth(db, LAST);
	});

	bench('loadEngineInput (SQL only)', () => {
		loadEngineInput(db);
	});

	bench('computeBudget (engine only)', () => {
		computeBudget(input, LAST);
	});
});
