import type { Db, Table } from './connection';
import type { ArgSpec } from './args';
import type { BackupSecret } from './backup-crypto';
import { ALL_TABLES } from './connection';
import { exportCsv, exportJson } from './export';
import * as meta from './repos/meta';
import * as accounts from './repos/accounts';
import * as categories from './repos/categories';
import * as payees from './repos/payees';
import * as transactions from './repos/transactions';
import * as schedules from './repos/schedules';
import * as budget from './repos/budget';
import * as reports from './repos/reports';
import * as demo from './repos/demo';
import * as imports from './repos/imports';
import * as payeeRules from './repos/payee-rules';

interface Handler<A extends unknown[], R> {
	kind: 'read' | 'write';
	tables: readonly Table[];
	/** The top-level shape of each argument, checked before `fn` runs. */
	args: readonly string[];
	/** Whether the write can be taken back with `undo.apply` (see `undo.ts`). */
	undoable: boolean;
	fn: (db: Db, ...args: A) => R;
}

function read<A extends unknown[], R>(
	fn: (db: Db, ...args: A) => R,
	args: NoInfer<ArgSpec<A>>
): Handler<A, R> {
	return { kind: 'read', tables: [], args, fn, undoable: false };
}

function write<A extends unknown[], R>(
	tables: readonly Table[],
	fn: (db: Db, ...args: A) => R,
	args: NoInfer<ArgSpec<A>>,
	options: { undo?: boolean } = {}
): Handler<A, R> {
	return { kind: 'write', tables, args, fn, undoable: options.undo ?? false };
}

const TXN: readonly Table[] = ['transactions', 'transaction_splits', 'payees'];
const SCHED: readonly Table[] = ['schedules', 'schedule_splits'];

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
		// A starting balance is one plain transaction, and its category may be created again.
		create: write(['accounts', 'transactions', 'categories', 'meta'], accounts.createAccount, [
			'object'
		]),
		rename: write(['accounts'], accounts.renameAccount, ['string', 'string']),
		close: write(['accounts'], accounts.closeAccount, ['string']),
		reopen: write(['accounts'], accounts.reopenAccount, ['string']),
		setBilling: write(['accounts'], accounts.setBillingDays, ['string', 'object?']),
		delete: write(['accounts', ...SCHED], accounts.deleteAccount, ['string']),
		// An adjustment is one plain transaction, with no payee.
		reconcile: write(['accounts', 'transactions'], accounts.reconcileAccount, ['string', 'object'])
	},
	categories: {
		tree: read(categories.listCategoryTree, []),
		startingBalanceId: read(meta.startingBalanceCategoryId, []),
		createGroup: write(['category_groups'], categories.createGroup, ['object']),
		updateGroup: write(['category_groups'], categories.updateGroup, ['string', 'object']),
		deleteGroup: write(['category_groups', 'categories'], categories.deleteGroup, [
			'string',
			'string?'
		]),
		usage: read(categories.categoryUsage, ['string']),
		create: write(['categories'], categories.createCategory, ['object']),
		// With a group that doesn't exist yet, it creates that group too.
		createIn: write(['categories', 'category_groups'], categories.createCategoryIn, ['object']),
		update: write(['categories'], categories.updateCategory, ['string', 'object']),
		delete: write(
			['categories', 'budget_assignments', 'payee_rules', ...TXN, ...SCHED],
			categories.deleteCategory,
			['string', 'string?']
		),
		saveOrder: write(['category_groups', 'categories'], categories.saveCategoryOrder, ['array'])
	},
	payees: {
		list: read(payees.listPayees, []),
		create: write(['payees'], payees.createPayee, ['object']),
		rename: write(['payees'], payees.renamePayee, ['string', 'string']),
		merge: write(['payees', 'transactions', 'schedules', 'payee_rules'], payees.mergePayee, [
			'string',
			'string'
		]),
		setDefaultCategory: write(['payees'], payees.setPayeeDefaultCategory, ['string', 'string?']),
		delete: write(['payees'], payees.deletePayee, ['string']),
		deleteUnused: write(['payees'], payees.deleteUnusedPayees, [])
	},
	payeeRules: {
		list: read(payeeRules.listRules, []),
		// A rule may name a payee that doesn't exist yet, which it creates.
		create: write(['payee_rules', 'payees'], payeeRules.createRule, ['object']),
		update: write(['payee_rules', 'payees'], payeeRules.updateRule, ['string', 'object']),
		delete: write(['payee_rules'], payeeRules.deleteRule, ['string'])
	},
	transactions: {
		list: read(transactions.listTransactions, ['object?']),
		get: read(transactions.getTransaction, ['string']),
		create: write(TXN, transactions.createTransaction, ['object']),
		update: write(TXN, transactions.updateTransaction, ['string', 'object']),
		delete: write(
			['transactions', 'transaction_splits'],
			transactions.deleteTransaction,
			['string'],
			{ undo: true }
		),
		setCleared: write(['transactions'], transactions.setCleared, ['string', 'boolean']),
		updateMany: write(['transactions'], transactions.updateTransactions, ['array', 'object'], {
			undo: true
		}),
		deleteMany: write(
			['transactions', 'transaction_splits'],
			transactions.deleteTransactions,
			['array'],
			{ undo: true }
		)
	},
	imports: {
		preview: read(imports.previewImport, ['string', 'array']),
		csvFormat: read(imports.getCsvFormat, ['string']),
		// New lines create payees; matched ones only change their own row.
		commit: write(
			['transactions', 'payees', 'accounts'],
			imports.importTransactions,
			['string', 'object'],
			{ undo: true }
		)
	},
	schedules: {
		list: read(schedules.listSchedules, ['string']),
		get: read(schedules.getSchedule, ['string', 'string']),
		upcoming: read(schedules.upcomingOccurrences, ['object']),
		create: write([...SCHED, 'payees'], schedules.createSchedule, ['object']),
		// The first installment is entered and the rest scheduled; neither is ever split.
		createInstallments: write(
			['schedules', 'transactions', 'payees'],
			schedules.createInstallments,
			['object', 'number']
		),
		update: write([...SCHED, 'payees'], schedules.updateSchedule, ['string', 'object']),
		delete: write(SCHED, schedules.deleteSchedule, ['string']),
		enter: write(['schedules', ...TXN], schedules.enterOccurrence, ['string', 'number', 'object']),
		skip: write(['schedules'], schedules.skipOccurrence, ['string', 'number'], { undo: true }),
		// Entered with the schedule's own payee, which exists.
		enterDue: write(
			['schedules', 'transactions', 'transaction_splits'],
			schedules.enterDueOccurrences,
			['string']
		)
	},
	budget: {
		month: read(budget.getBudgetMonth, ['string']),
		setAssigned: write(['budget_assignments'], budget.setAssigned, ['string', 'string', 'number'], {
			undo: true
		}),
		moveMoney: write(['budget_assignments'], budget.moveMoney, ['object'], { undo: true }),
		quickAssign: write(['budget_assignments'], budget.applyQuickAssign, ['object'], {
			undo: true
		}),
		previewQuickAssign: read(budget.previewQuickAssign, ['object'])
	},
	reports: {
		spending: read(reports.spendingByCategory, ['object']),
		netWorth: read(reports.netWorth, ['string']),
		cashFlow: read(reports.cashFlow, ['object']),
		categoryMonths: read(reports.categoryMonths, ['object']),
		payees: read(reports.spendingByPayee, ['object']),
		accountBalances: read(reports.accountBalances, ['string']),
		ageOfMoney: read(reports.ageOfMoney, ['string'])
	},
	backup: {
		csv: read((db: Db) => exportCsv(db), []),
		json: read((db: Db) => exportJson(db), [])
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

export interface ExportedBackup {
	bytes: Uint8Array<ArrayBuffer>;
	skipped: string[];
	/** Whether the backup was encrypted with this device's backup key. */
	encrypted: boolean;
}

/** A budget in a backup. `id` is the uuid of its file name, or null in a legacy `.sqlite` backup. */
export interface BackupBudgetInfo {
	index: number;
	id: string | null;
	name: string;
}

export interface BackupInfo {
	/** When the backup was made, or null for a legacy `.sqlite` backup. */
	createdAt: string | null;
	budgets: BackupBudgetInfo[];
}

/** A backup `inspectBackup` checked, and the token to restore it by. */
export interface InspectedBackup extends BackupInfo {
	token: string;
}

/** Which budget of a backup (by index) to restore into which file. */
export interface RestorePick {
	index: number;
	file: string;
}

/** Worker-level operations that manage budget files rather than query one. */
export interface SystemApi {
	/** Opens a budget file (creating it if needed) and migrates it, saving a copy first. */
	open(fileName: string): Promise<void>;
	close(): void;
	listFiles(): string[];
	/** Deletes a budget file and its saved copies. */
	deleteFile(fileName: string): void;
	/** A budget's saved copies (before a migration or a replacing restore), newest first. */
	listCopies(fileName: string): BudgetCopy[];
	/** A pre-migration copy as the bytes of a `.sqlite` file, to restore or download as a backup. */
	readCopy(copyName: string): Uint8Array<ArrayBuffer>;
	/** Closes the database and lets go of the OPFS files so another tab can open them. */
	release(): void;
	/** Deletes every file (budgets, copies, the demo) and the backup key of this device. */
	wipe(): Promise<void>;
	/**
	 * Budget files or saved copies as one `.moneta` backup, encrypted when this device has a backup
	 * key. Files that can't be read are left out and listed in `skipped`. BACKUP_KEYS_UNAVAILABLE
	 * when the key can't be read; `plain` then backs up without encryption, when the user says so.
	 */
	exportBackup(names: string[], options?: { plain?: boolean }): Promise<ExportedBackup>;
	/** Records in each budget file when it was last backed up. Files that can't be written are skipped. */
	markBackedUp(fileNames: string[], at: string): void;
	/**
	 * Checks a `.moneta` (or legacy `.sqlite`) backup and lists its budgets. Writes nothing. The
	 * token lets `restoreInspected` restore them without unpacking and checking them again.
	 */
	inspectBackup(bytes: Uint8Array): InspectedBackup;
	/**
	 * Restores budgets from a backup into the given files, all checked before any is written. A
	 * file that exists is replaced and kept as a saved copy; the open one is closed first.
	 */
	restoreBackup(bytes: Uint8Array, picks: RestorePick[]): Promise<void>;
	/** `restoreBackup` for the budgets the last `inspectBackup` checked, by its token. */
	restoreInspected(token: string, picks: RestorePick[]): Promise<void>;
	/** Whether backups made on this device are encrypted. */
	backupEncryption(): Promise<{ on: boolean }>;
	/**
	 * Turns on backup encryption, or replaces its setup: a new key opened by `password` or
	 * `recoveryKey`. Backups made before keep their own password and recovery key.
	 */
	setBackupEncryption(password: string, recoveryKey: string): Promise<void>;
	/** Turns backup encryption off. Backups made before stay encrypted. */
	clearBackupEncryption(): Promise<void>;
	/** Whether `password` is the one set for backups on this device. */
	checkBackupPassword(password: string): Promise<boolean>;
	/** Whether `bytes` are an encrypted `.moneta` backup. */
	isEncryptedBackup(bytes: Uint8Array): boolean;
	/** The plain backup inside an encrypted one, for `inspectBackup` and `restoreBackup`. */
	unlockBackup(bytes: Uint8Array, secret: BackupSecret): Promise<Uint8Array<ArrayBuffer>>;
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
} & {
	system: { [M in keyof SystemApi]: Promisify<SystemApi[M]> };
	/** Takes back the undoable write that returned `token`, if it is still the latest one. */
	undo: { apply(token: string): Promise<void> };
};

export function findHandler(method: string): Handler<unknown[], unknown> | undefined {
	const [ns, name] = method.split('.');
	const group = (api as Record<string, Record<string, Handler<unknown[], unknown>>>)[ns];
	return Object.hasOwn(api, ns) && Object.hasOwn(group, name) ? group[name] : undefined;
}
