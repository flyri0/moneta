import type { Db, Table } from './connection';
import type { ArgSpec } from './args';
import { ALL_TABLES } from './connection';
import * as meta from './repos/meta';
import * as accounts from './repos/accounts';
import * as categories from './repos/categories';
import * as payees from './repos/payees';
import * as transactions from './repos/transactions';
import * as budget from './repos/budget';
import * as dump from './repos/dump';
import * as reports from './repos/reports';
import * as demo from './repos/demo';

interface Handler<A extends unknown[], R> {
	kind: 'read' | 'write';
	tables: readonly Table[];
	/** The top-level shape of each argument, checked before `fn` runs. */
	args: readonly string[];
	fn: (db: Db, ...args: A) => R;
}

function read<A extends unknown[], R>(
	fn: (db: Db, ...args: A) => R,
	args: NoInfer<ArgSpec<A>>
): Handler<A, R> {
	return { kind: 'read', tables: [], args, fn };
}

function write<A extends unknown[], R>(
	tables: readonly Table[],
	fn: (db: Db, ...args: A) => R,
	args: NoInfer<ArgSpec<A>>
): Handler<A, R> {
	return { kind: 'write', tables, args, fn };
}

const TXN: readonly Table[] = ['transactions', 'transaction_splits', 'payees'];

/** Every operation the UI can call. Writes declare the tables they change. */
export const api = {
	meta: {
		isInitialized: read(meta.isInitialized, []),
		get: read(meta.getMeta, []),
		update: write(['meta'], meta.updateMeta, ['object']),
		init: write(ALL_TABLES, meta.initBudget, ['object'])
	},
	accounts: {
		list: read(accounts.listAccounts, []),
		get: read(accounts.getAccount, ['string']),
		create: write(['accounts', 'categories', ...TXN], accounts.createAccount, ['object']),
		rename: write(['accounts', 'categories'], accounts.renameAccount, ['string', 'string']),
		close: write(['accounts', 'categories'], accounts.closeAccount, ['string']),
		reopen: write(['accounts', 'categories'], accounts.reopenAccount, ['string']),
		delete: write(['accounts', 'categories', 'budget_assignments'], accounts.deleteAccount, [
			'string'
		])
	},
	categories: {
		tree: read(categories.listCategoryTree, []),
		createGroup: write(['category_groups'], categories.createGroup, ['object']),
		updateGroup: write(['category_groups'], categories.updateGroup, ['string', 'object']),
		deleteGroup: write(['category_groups'], categories.deleteGroup, ['string']),
		create: write(['categories'], categories.createCategory, ['object']),
		update: write(['categories'], categories.updateCategory, ['string', 'object']),
		delete: write(['categories', 'budget_assignments', ...TXN], categories.deleteCategory, [
			'string',
			'string?'
		]),
		saveOrder: write(['category_groups', 'categories'], categories.saveCategoryOrder, ['array'])
	},
	payees: {
		list: read(payees.listPayees, [])
	},
	transactions: {
		list: read(transactions.listTransactions, ['object?']),
		get: read(transactions.getTransaction, ['string']),
		create: write(TXN, transactions.createTransaction, ['object']),
		update: write(TXN, transactions.updateTransaction, ['string', 'object']),
		delete: write(TXN, transactions.deleteTransaction, ['string']),
		setCleared: write(['transactions'], transactions.setCleared, ['string', 'boolean'])
	},
	budget: {
		month: read(budget.getBudgetMonth, ['string']),
		setAssigned: write(['budget_assignments'], budget.setAssigned, ['string', 'string', 'number']),
		moveMoney: write(['budget_assignments'], budget.moveMoney, ['object']),
		quickAssign: write(['budget_assignments'], budget.applyQuickAssign, ['object'])
	},
	reports: {
		spending: read(reports.spendingByCategory, ['object']),
		netWorth: read(reports.netWorth, ['string'])
	},
	backup: {
		dump: read((db: Db) => dump.dumpBudget(db), [])
	},
	demo: {
		create: write(ALL_TABLES, demo.createDemo, ['object'])
	}
};

export type Api = typeof api;

/** A copy of a budget file saved before migrating it. */
export interface BudgetCopy {
	name: string;
	/** ISO date and time the copy was saved. */
	savedAt: string;
}

/** Worker-level operations that manage budget files rather than query one. */
export interface SystemApi {
	/** Opens a budget file (creating it if needed) and migrates it, saving a copy first. */
	open(fileName: string): Promise<void>;
	close(): void;
	listFiles(): string[];
	/** Deletes a budget file and its pre-migration copies. */
	deleteFile(fileName: string): void;
	/**
	 * Deletes `oldFile` and its copies, keeping `oldFile` itself as a copy of `newFile`, so a
	 * restore that replaced a budget can be undone from `newFile`'s copies.
	 */
	replaceFile(oldFile: string, newFile: string): Promise<void>;
	/** A budget's saved copies (before a migration or a replacing restore), newest first. */
	listCopies(fileName: string): BudgetCopy[];
	/** A pre-migration copy as the bytes of a `.sqlite` file, to restore or download as a backup. */
	readCopy(copyName: string): Uint8Array<ArrayBuffer>;
	/** Closes the database and lets go of the OPFS files so another tab can open them. */
	release(): void;
	/** The open budget as the bytes of a `.sqlite` file. */
	exportFile(): Uint8Array<ArrayBuffer>;
	/** Checks a `.sqlite` backup, migrates it and saves it as a new file, left closed. */
	importFile(fileName: string, bytes: Uint8Array): Promise<void>;
}

type Promisify<T> = T extends (...args: infer A) => infer R
	? (...args: A) => Promise<Awaited<R>>
	: never;

/** The client-side view of the API: same names, db argument removed, async results. */
export type ClientApi = {
	[NS in keyof Api]: {
		[M in keyof Api[NS]]: Api[NS][M] extends Handler<infer A, infer R>
			? (...args: A) => Promise<R>
			: never;
	};
} & { system: { [M in keyof SystemApi]: Promisify<SystemApi[M]> } };

export function findHandler(method: string): Handler<unknown[], unknown> | undefined {
	const [ns, name] = method.split('.');
	const group = (api as Record<string, Record<string, Handler<unknown[], unknown>>>)[ns];
	return Object.hasOwn(api, ns) && Object.hasOwn(group, name) ? group[name] : undefined;
}
