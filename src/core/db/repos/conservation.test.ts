import { describe, it, expect } from 'vitest';
import { createBudgetDb } from '../testing';
import { all, type Db } from '../connection';
import { DomainError } from '$domain/errors';
import { addMonths } from '$domain/month';
import { closeAccount, createAccount, listAccounts } from './accounts';
import { applyQuickAssign, getBudgetMonth, moveMoney, setAssigned } from './budget';
import { deleteCategory, updateCategory } from './categories';
import { readyToAssignCategoryId } from './meta';
import { createTransaction, deleteTransaction, updateTransaction } from './transactions';

/*
 * Money conservation. Every unit of on-budget cash is either unassigned (Ready to Assign)
 * or sits in some category's Available. Card payment categories hold cash set aside for card
 * debt, and a category whose negative balance carries forward (toggle on) has its credit
 * overspending in Available even though that is card debt, not cash, so it is added back:
 *
 *   RTA + Σ available + Σ carried credit overspending = Σ balances of on-budget non-card accounts
 *
 * It is checked the month after the last data, where every cash overspending has already
 * been deducted from RTA (toggle off) or carried into Available (toggle on).
 */

/** mulberry32: a tiny seeded PRNG so a failing trial reproduces from its seed. */
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const TRIALS = 50;
const STEPS = 40;
const STRATEGIES = ['last-month', 'avg-3', 'cover-overspending', 'clear'] as const;

async function randomHistory(rnd: () => number): Promise<Db> {
	const pick = <T>(items: readonly T[]) => items[Math.floor(rnd() * items.length)];
	const amount = () => Math.round((rnd() * 2 - 1.3) * 10000); // skewed toward outflows

	const db = await createBudgetDb();
	const rta = readyToAssignCategoryId(db);
	const ids = (sql: string) => all<{ id: string }>(db, sql).map((r) => r.id);
	const regular = () =>
		ids('SELECT id FROM categories WHERE system IS NULL AND cc_account_id IS NULL');
	const cardPayment = () => ids('SELECT id FROM categories WHERE cc_account_id IS NOT NULL');

	const opening = (name: string, type: 'checking' | 'savings' | 'credit_card' | 'investment') =>
		({ name, type, onBudget: type !== 'investment', startingDate: '2026-01-01' }) as const;
	const accounts = [
		createAccount(db, { ...opening('Checking', 'checking'), startingBalance: 50000 }),
		createAccount(db, { ...opening('Savings', 'savings'), startingBalance: 10000 }),
		createAccount(db, { ...opening('Visa', 'credit_card'), startingBalance: -20000 }),
		createAccount(db, { ...opening('Amex', 'credit_card'), startingBalance: 0 }),
		createAccount(db, { ...opening('Broker', 'investment'), startingBalance: 30000 })
	];
	const transactions: string[] = [];

	for (let step = 0; step < STEPS; step++) {
		const month = `2026-0${1 + Math.floor(rnd() * 5)}`;
		const date = `${month}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
		const categories = [...regular(), rta];
		const r = rnd();
		try {
			if (r < 0.3) {
				const categoryId = rnd() < 0.15 ? null : pick(categories);
				transactions.push(
					createTransaction(db, { accountId: pick(accounts), date, amount: amount(), categoryId })
				);
			} else if (r < 0.35) {
				const [a, b] = [amount(), amount()];
				transactions.push(
					createTransaction(db, {
						accountId: pick(accounts),
						date,
						amount: a + b,
						splits: [
							{ categoryId: pick(categories), amount: a },
							{ categoryId: pick(categories), amount: b }
						]
					})
				);
			} else if (r < 0.55) {
				transactions.push(
					createTransaction(db, {
						accountId: pick(accounts),
						date,
						amount: amount(),
						transferAccountId: pick(accounts),
						categoryId: rnd() < 0.5 ? pick(categories) : null
					})
				);
			} else if (r < 0.7) {
				setAssigned(db, pick([...regular(), ...cardPayment()]), month, amount());
			} else if (r < 0.75) {
				moveMoney(db, {
					fromCategoryId: pick(regular()),
					toCategoryId: pick(regular()),
					month,
					amount: Math.abs(amount()) + 1
				});
			} else if (r < 0.8) {
				updateCategory(db, pick([...regular(), ...cardPayment()]), {
					carryoverOverspending: rnd() < 0.5
				});
			} else if (r < 0.85 && transactions.length > 0) {
				updateTransaction(db, pick(transactions), {
					accountId: pick(accounts),
					date,
					amount: amount(),
					categoryId: pick(categories)
				});
			} else if (r < 0.9 && transactions.length > 0) {
				deleteTransaction(db, pick(transactions));
			} else if (r < 0.93) {
				deleteCategory(db, pick(regular()), pick(regular()));
			} else if (r < 0.97) {
				applyQuickAssign(db, {
					month,
					categoryIds: regular().slice(0, 2),
					strategy: pick(STRATEGIES)
				});
			} else {
				closeAccount(db, pick(accounts));
			}
		} catch (e) {
			// Rejected operations are part of the history; anything but a DomainError is a bug.
			if (!(e instanceof DomainError)) throw e;
		}
	}
	return db;
}

function conservationGap(db: Db): number {
	const { m: lastData } = all<{ m: string | null }>(
		db,
		`SELECT MAX(m) AS m FROM (
			SELECT substr(date, 1, 7) AS m FROM transactions UNION SELECT month FROM budget_assignments)`
	)[0];
	const view = getBudgetMonth(db, addMonths(lastData ?? '2026-01', 1));
	let budgeted = view.readyToAssign;
	for (const g of view.groups)
		for (const c of g.categories) budgeted += c.available + c.creditOverspent;
	const cash = listAccounts(db)
		.filter((a) => a.onBudget && a.type !== 'credit_card')
		.reduce((sum, a) => sum + a.balance, 0);
	return budgeted - cash;
}

describe('money conservation', () => {
	// Fifty whole budgets, each built one write at a time, sit close enough to the default 5s that
	// a loaded machine tips them over. The check is the point, not how fast it runs.
	it('holds across seeded random histories written through the repos', async () => {
		const gaps: { seed: number; gap: number }[] = [];
		for (let seed = 1; seed <= TRIALS; seed++) {
			const db = await randomHistory(mulberry32(seed));
			const gap = conservationGap(db);
			if (gap !== 0) gaps.push({ seed, gap });
			db.close();
		}
		expect(gaps).toEqual([]);
	}, 30_000);
});
