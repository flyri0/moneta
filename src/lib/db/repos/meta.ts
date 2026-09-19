import { uuidv7 } from 'uuidv7';
import { DomainError } from '$lib/domain/errors';
import { currencyDigits } from '$lib/domain/money';
import { all, nowIso, one, run, tx, type Db } from '../connection';

export interface BudgetMeta {
	name: string;
	currency: string;
	locale: string;
	createdAt: string;
	lastBackupAt: string | null;
}

export type MetaPatch = Partial<Pick<BudgetMeta, 'name' | 'currency' | 'locale' | 'lastBackupAt'>>;

export interface InitBudgetInput {
	name: string;
	currency: string;
	locale: string;
	groups: { name: string; categories: string[] }[];
}

const KEYS = {
	name: 'name',
	currency: 'currency',
	locale: 'locale',
	createdAt: 'created_at',
	lastBackupAt: 'last_backup_at'
} as const;

function setKey(db: Db, key: string, value: string | null): void {
	if (value === null) run(db, 'DELETE FROM meta WHERE key = ?', [key]);
	else
		run(
			db,
			'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
			[key, value]
		);
}

export function isInitialized(db: Db): boolean {
	return one(db, "SELECT 1 AS x FROM meta WHERE key = 'name'") !== undefined;
}

export function getMeta(db: Db): BudgetMeta {
	const rows = all<{ key: string; value: string }>(db, 'SELECT key, value FROM meta');
	const map = new Map(rows.map((r) => [r.key, r.value]));
	if (!map.has(KEYS.name)) throw new DomainError('NOT_FOUND', 'Budget is not initialized');
	return {
		name: map.get(KEYS.name)!,
		currency: map.get(KEYS.currency)!,
		locale: map.get(KEYS.locale)!,
		createdAt: map.get(KEYS.createdAt)!,
		lastBackupAt: map.get(KEYS.lastBackupAt) ?? null
	};
}

function validateCurrency(currency: string): void {
	try {
		currencyDigits(currency);
	} catch {
		throw new DomainError('INVALID_INPUT', `Unknown currency ${currency}`);
	}
}

function validateLocale(locale: string): void {
	try {
		Intl.getCanonicalLocales(locale);
	} catch {
		throw new DomainError('INVALID_INPUT', `Invalid locale ${locale}`);
	}
}

export function updateMeta(db: Db, patch: MetaPatch): void {
	tx(db, () => {
		const current = getMeta(db);
		if (patch.name !== undefined) {
			if (!patch.name.trim()) throw new DomainError('INVALID_INPUT', 'Name is required');
			setKey(db, KEYS.name, patch.name.trim());
		}
		if (patch.currency !== undefined && patch.currency !== current.currency) {
			validateCurrency(patch.currency);
			const hasData =
				one(db, 'SELECT 1 AS x FROM transactions LIMIT 1') !== undefined ||
				one(db, 'SELECT 1 AS x FROM budget_assignments LIMIT 1') !== undefined;
			if (hasData && currencyDigits(patch.currency) !== currencyDigits(current.currency)) {
				throw new DomainError(
					'CURRENCY_LOCKED',
					'Cannot switch to a currency with different minor units once data exists'
				);
			}
			setKey(db, KEYS.currency, patch.currency);
		}
		if (patch.locale !== undefined) {
			validateLocale(patch.locale);
			setKey(db, KEYS.locale, patch.locale);
		}
		if (patch.lastBackupAt !== undefined) setKey(db, KEYS.lastBackupAt, patch.lastBackupAt);
	});
}

/** Creates meta, the system groups/categories, and the user's starting groups. */
export function initBudget(db: Db, input: InitBudgetInput): void {
	tx(db, () => {
		if (isInitialized(db)) throw new DomainError('ALREADY_INITIALIZED');
		if (!input.name.trim()) throw new DomainError('INVALID_INPUT', 'Name is required');
		validateCurrency(input.currency);
		validateLocale(input.locale);
		setKey(db, KEYS.name, input.name.trim());
		setKey(db, KEYS.currency, input.currency);
		setKey(db, KEYS.locale, input.locale);
		setKey(db, KEYS.createdAt, nowIso());

		const incomeGroup = uuidv7();
		run(
			db,
			"INSERT INTO category_groups (id, name, sort_order, system) VALUES (?, 'Income', 0, 'income')",
			[incomeGroup]
		);
		run(
			db,
			"INSERT INTO categories (id, group_id, name, sort_order, system) VALUES (?, ?, 'Ready to Assign', 0, 'ready_to_assign')",
			[uuidv7(), incomeGroup]
		);
		run(
			db,
			"INSERT INTO category_groups (id, name, sort_order, system) VALUES (?, 'Credit Card Payments', 1, 'credit_card_payments')",
			[uuidv7()]
		);
		input.groups.forEach((group, gi) => {
			const groupId = uuidv7();
			run(db, 'INSERT INTO category_groups (id, name, sort_order) VALUES (?, ?, ?)', [
				groupId,
				group.name,
				gi + 2
			]);
			group.categories.forEach((name, ci) => {
				run(db, 'INSERT INTO categories (id, group_id, name, sort_order) VALUES (?, ?, ?, ?)', [
					uuidv7(),
					groupId,
					name,
					ci
				]);
			});
		});
	});
}

export function readyToAssignCategoryId(db: Db): string {
	const row = one<{ id: string }>(db, "SELECT id FROM categories WHERE system = 'ready_to_assign'");
	if (!row) throw new DomainError('NOT_FOUND', 'Budget is not initialized');
	return row.id;
}

export function systemGroupId(db: Db, system: 'income' | 'credit_card_payments'): string {
	const row = one<{ id: string }>(db, 'SELECT id FROM category_groups WHERE system = ?', [system]);
	if (!row) throw new DomainError('NOT_FOUND', 'Budget is not initialized');
	return row.id;
}
