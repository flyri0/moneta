import type { Db, Table } from './connection';
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
	fn: (db: Db, ...args: A) => R;
}

function read<A extends unknown[], R>(fn: (db: Db, ...args: A) => R): Handler<A, R> {
	return { kind: 'read', tables: [], fn };
}

function write<A extends unknown[], R>(
	tables: readonly Table[],
	fn: (db: Db, ...args: A) => R
): Handler<A, R> {
	return { kind: 'write', tables, fn };
}

const TXN: readonly Table[] = ['transactions', 'transaction_splits', 'payees'];

/** Every operation the UI can call. Writes declare the tables they change. */
export const api = {
	meta: {
		isInitialized: read(meta.isInitialized),
		get: read(meta.getMeta),
		update: write(['meta'], meta.updateMeta),
		init: write(ALL_TABLES, meta.initBudget)
	},
	accounts: {
		list: read(accounts.listAccounts),
		get: read(accounts.getAccount),
		create: write(['accounts', 'categories', ...TXN], accounts.createAccount),
		rename: write(['accounts', 'categories'], accounts.renameAccount),
		close: write(['accounts', 'categories'], accounts.closeAccount),
		reopen: write(['accounts', 'categories'], accounts.reopenAccount),
		delete: write(['accounts', 'categories', 'budget_assignments'], accounts.deleteAccount)
	},
	categories: {
		tree: read(categories.listCategoryTree),
		createGroup: write(['category_groups'], categories.createGroup),
		updateGroup: write(['category_groups'], categories.updateGroup),
		deleteGroup: write(['category_groups'], categories.deleteGroup),
		create: write(['categories'], categories.createCategory),
		update: write(['categories'], categories.updateCategory),
		delete: write(['categories', 'budget_assignments', ...TXN], categories.deleteCategory),
		saveOrder: write(['category_groups', 'categories'], categories.saveCategoryOrder)
	},
	payees: {
		list: read(payees.listPayees)
	},
	transactions: {
		list: read(transactions.listTransactions),
		get: read(transactions.getTransaction),
		create: write(TXN, transactions.createTransaction),
		update: write(TXN, transactions.updateTransaction),
		delete: write(TXN, transactions.deleteTransaction),
		setCleared: write(['transactions'], transactions.setCleared)
	},
	budget: {
		month: read(budget.getBudgetMonth),
		setAssigned: write(['budget_assignments'], budget.setAssigned),
		moveMoney: write(['budget_assignments'], budget.moveMoney),
		quickAssign: write(['budget_assignments'], budget.applyQuickAssign)
	},
	reports: {
		spending: read(reports.spendingByCategory),
		netWorth: read(reports.netWorth)
	},
	backup: {
		dump: read((db) => dump.dumpBudget(db))
	},
	demo: {
		create: write(ALL_TABLES, demo.createDemo)
	}
};

export type Api = typeof api;

/** Worker-level operations that manage budget files rather than query one. */
export interface SystemApi {
	/** Opens a budget file (creating it if needed) and migrates it, saving a copy first. */
	open(fileName: string): Promise<void>;
	close(): void;
	listFiles(): string[];
	/** Deletes a budget file and its pre-migration copies. */
	deleteFile(fileName: string): void;
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
