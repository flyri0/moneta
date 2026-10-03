import type { BindingSpec, Database } from '@sqlite.org/sqlite-wasm';

export type Db = Database;

export type Table =
	| 'meta'
	| 'accounts'
	| 'category_groups'
	| 'categories'
	| 'payees'
	| 'transactions'
	| 'transaction_splits'
	| 'budget_assignments'
	| 'schedules'
	| 'schedule_splits'
	| 'payee_rules';

export const ALL_TABLES: readonly Table[] = [
	'meta',
	'accounts',
	'category_groups',
	'categories',
	'payees',
	'transactions',
	'transaction_splits',
	'budget_assignments',
	'schedules',
	'schedule_splits',
	'payee_rules'
];

/** Per-connection settings. Must run outside any transaction. */
export function configure(db: Db): void {
	db.exec('PRAGMA foreign_keys = ON');
}

const depths = new WeakMap<Db, number>();

/** Runs `fn` atomically. Nests safely (uses SAVEPOINT). */
export function tx<T>(db: Db, fn: () => T): T {
	depths.set(db, (depths.get(db) ?? 0) + 1);
	try {
		return db.savepoint(() => fn());
	} finally {
		depths.set(db, depths.get(db)! - 1);
	}
}

/** Whether `fn` of a `tx` on `db` is running. */
export function inTransaction(db: Db): boolean {
	return (depths.get(db) ?? 0) > 0;
}

export function all<T>(db: Db, sql: string, bind?: BindingSpec): T[] {
	return db.selectObjects(sql, bind) as unknown as T[];
}

export function one<T>(db: Db, sql: string, bind?: BindingSpec): T | undefined {
	return db.selectObject(sql, bind) as unknown as T | undefined;
}

export function run(db: Db, sql: string, bind?: BindingSpec): void {
	db.exec({ sql, bind });
}

export function nowIso(): string {
	return new Date().toISOString();
}
