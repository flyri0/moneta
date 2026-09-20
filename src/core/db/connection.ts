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
	| 'budget_assignments';

export const ALL_TABLES: readonly Table[] = [
	'meta',
	'accounts',
	'category_groups',
	'categories',
	'payees',
	'transactions',
	'transaction_splits',
	'budget_assignments'
];

/** Per-connection settings. Must run outside any transaction. */
export function configure(db: Db): void {
	db.exec('PRAGMA foreign_keys = ON');
}

/** Runs `fn` atomically. Nests safely (uses SAVEPOINT). */
export function tx<T>(db: Db, fn: () => T): T {
	return db.savepoint(() => fn());
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
