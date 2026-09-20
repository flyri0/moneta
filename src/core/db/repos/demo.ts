import { READY_TO_ASSIGN, type DemoBudgetSeed } from '$features/demo/seed';
import { DomainError } from '$domain/errors';
import { tx, type Db } from '../connection';
import { createAccount } from './accounts';
import { setAssigned } from './budget';
import { listCategoryTree } from './categories';
import { initBudget, readyToAssignCategoryId } from './meta';
import { createTransaction } from './transactions';

function lookup(map: Map<string, string>, key: string, what: string): string {
	const id = map.get(key);
	if (!id) throw new DomainError('NOT_FOUND', `Demo ${what} ${key} not found`);
	return id;
}

/**
 * Writes a whole demo budget in one transaction, so an interrupted seed leaves a file that is not
 * initialized at all rather than a half-filled one. It goes through the ordinary repos, so the
 * domain rules, the card payment category and the starting-balance transactions all still apply.
 */
export function createDemo(db: Db, budget: DemoBudgetSeed): void {
	const { seed } = budget;
	tx(db, () => {
		initBudget(db, budget.init);
		const accounts = new Map<string, string>();
		for (const { key, ...input } of seed.accounts) accounts.set(key, createAccount(db, input));

		const categories = new Map<string, string>();
		for (const group of listCategoryTree(db)) {
			// Card payment categories are managed by the engine and can never be used here.
			for (const category of group.categories) {
				if (!category.ccAccountId) categories.set(category.name, category.id);
			}
		}
		categories.set(READY_TO_ASSIGN, readyToAssignCategoryId(db));

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

		for (const a of seed.assignments) {
			setAssigned(db, lookup(categories, a.categoryName, 'category'), a.month, a.amount);
		}
	});
}
