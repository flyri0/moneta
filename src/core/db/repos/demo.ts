import type { DemoBudgetSeed } from '$features/demo/seed';
import { DomainError } from '$domain/errors';
import { tx, type Db } from '../connection';
import { createAccount } from './accounts';
import { setAssigned } from './budget';
import { listCategoryTree } from './categories';
import { initBudget } from './meta';
import { createSchedule } from './schedules';
import { createTransaction } from './transactions';

function lookup(map: Map<string, string>, key: string, what: string): string {
	const id = map.get(key);
	if (!id) throw new DomainError('NOT_FOUND', `Demo ${what} ${key} not found`);
	return id;
}

/**
 * Writes a whole demo budget in one transaction, so an interrupted seed leaves a file that is not
 * initialized at all rather than a half-filled one. It goes through the ordinary repos, so the
 * domain rules and the starting-balance transactions all still apply.
 */
export function createDemo(db: Db, budget: DemoBudgetSeed): void {
	const { seed } = budget;
	tx(db, () => {
		initBudget(db, budget.init);
		const accounts = new Map<string, string>();
		for (const { key, ...input } of seed.accounts) accounts.set(key, createAccount(db, input));

		const categories = new Map<string, string>();
		for (const group of listCategoryTree(db)) {
			for (const category of group.categories) {
				categories.set(category.name, category.id);
			}
		}

		for (const t of seed.transactions) {
			createTransaction(db, {
				accountId: lookup(accounts, t.accountKey, 'account'),
				date: t.date,
				amount: t.amount,
				payeeName: t.payeeName,
				categoryId: t.categoryName ? lookup(categories, t.categoryName, 'category') : null,
				memo: t.memo,
				cleared: t.cleared,
				splits: t.splits?.map((s) => ({
					categoryId: lookup(categories, s.categoryName, 'category'),
					amount: s.amount,
					memo: s.memo
				})),
				transferAccountId: t.transferAccountKey
					? lookup(accounts, t.transferAccountKey, 'account')
					: null
			});
		}

		for (const s of seed.schedules) {
			createSchedule(db, {
				accountId: lookup(accounts, s.accountKey, 'account'),
				amount: s.amount,
				payeeName: s.payeeName,
				categoryId: s.categoryName ? lookup(categories, s.categoryName, 'category') : null,
				transferAccountId: s.transferAccountKey
					? lookup(accounts, s.transferAccountKey, 'account')
					: null,
				startDate: s.startDate,
				frequency: 'monthly',
				interval: 1,
				endDate: null,
				endCount: null,
				weekend: 'keep',
				autoEnter: s.autoEnter
			});
		}

		for (const a of seed.assignments) {
			setAssigned(db, lookup(categories, a.categoryName, 'category'), a.month, a.amount);
		}
	});
}
