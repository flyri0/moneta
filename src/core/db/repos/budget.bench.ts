import { expect, test } from 'vitest';
import { computeBudget } from '$domain/budget-engine';
import { addMonths, monthRange } from '$domain/month';
import { createBudgetDb } from '../testing';
import { run, tx, type Db } from '../connection';
import { createAccount } from './accounts';
import { loadEngineInput } from './aggregates';
import { createCategory, createGroup } from './categories';
import { getBudgetMonth, setAssigned } from './budget';
import { defaultIncomeCategoryId } from './meta';
import { ageOfMoney, ageOfMoneyFlows } from './reports';
import { createTransaction, listTransactions } from './transactions';

const YEARS = 5;
const CATEGORIES = 40;
const SPENDING_PER_MONTH = 150;
const PAYEES = 120;
const LAST = '2026-09';

/**
 * A heavy personal budget: 5 years, 40 categories, a checking account and a card,
 * 150 purchases a month (about 9,000 transactions, among 120 payees, a quarter with a memo) and
 * an assignment per category and month. `analyze` runs ANALYZE, which the app itself never does.
 */
async function bigBudget({ analyze = true } = {}): Promise<Db> {
	const db = await createBudgetDb();
	const base = { onBudget: true, startingBalance: 0, startingDate: '2021-10-01' };
	const bank = createAccount(db, { ...base, name: 'Bank', type: 'checking' });
	const card = createAccount(db, { ...base, name: 'Card', type: 'credit_card' });
	const group = createGroup(db, { name: 'Bench' });
	const categories = Array.from({ length: CATEGORIES }, (_, i) =>
		createCategory(db, { groupId: group, name: `Category ${i + 1}` })
	);
	const income = defaultIncomeCategoryId(db);
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
					categoryId: categories[i % CATEGORIES],
					payeeName: `Payee ${i % PAYEES}`,
					memo: i % 4 === 0 ? `Nota número ${month}-${i}` : ''
				});
			}
		}
	});
	if (analyze) run(db, 'ANALYZE');
	return db;
}

const db = await bigBudget();
const input = loadEngineInput(db);

test('budget recompute', async ({ bench }) => {
	const result = await bench.compare(
		bench('getBudgetMonth, 5 years of history', () => {
			getBudgetMonth(db, LAST);
		}),
		bench('loadEngineInput (SQL only)', () => {
			loadEngineInput(db);
		}),
		bench('computeBudget (engine only)', () => {
			computeBudget(input, LAST);
		})
	);
	expect(result.get('computeBudget (engine only)')).toBeFasterThan(
		result.get('getBudgetMonth, 5 years of history')
	);
});

test('age of money', async ({ bench }) => {
	const result = await bench.compare(
		bench('ageOfMoney, 5 years of history', () => {
			ageOfMoney(db, `${LAST}-30`);
		}),
		bench('ageOfMoneyFlows (SQL only)', () => {
			ageOfMoneyFlows(db, `${LAST}-30`);
		})
	);
	expect(result.get('ageOfMoneyFlows (SQL only)')).toBeFasterThan(
		result.get('ageOfMoney, 5 years of history')
	);
});

test('transaction search', async ({ bench }) => {
	// Without ANALYZE, like the app: its statistics would change the plans measured here.
	const db = await bigBudget({ analyze: false });
	const page = { limit: 50 };
	const result = await bench.compare(
		bench('first page, no search', () => {
			listTransactions(db, page);
		}),
		bench('first page, a common word', () => {
			listTransactions(db, { ...page, search: 'card' });
		}),
		bench('a word nothing contains', () => {
			listTransactions(db, { ...page, search: 'zzz' });
		}),
		bench('three words no row has together (scans everything)', () => {
			listTransactions(db, { ...page, search: 'numero Payee 10,37' });
		})
	);
	expect(result.get('first page, no search')).toBeFasterThan(
		result.get('three words no row has together (scans everything)')
	);
});
