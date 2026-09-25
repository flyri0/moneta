import { describe, it, expect } from 'vitest';
import { demoBudget } from '$features/demo/content';
import { api } from './api';
import { all, ALL_TABLES, tx, type Db, type Table } from './connection';
import { createAccount, closeAccount } from './repos/accounts';
import { setAssigned } from './repos/budget';
import { createGroup, deleteCategory, listCategoryTree } from './repos/categories';
import { startingBalanceCategoryId } from './repos/meta';
import { getOrCreatePayee, setPayeeDefaultCategory } from './repos/payees';
import { createSchedule, type ScheduleInput } from './repos/schedules';
import { createTransaction } from './repos/transactions';
import { categoryId, createBudgetDb, createTestDb } from './testing';

/**
 * Writes declare the tables they change, and live queries refresh on that alone: a table left
 * out leaves a screen stale, one too many refetches for nothing. Each write runs here on a seeded
 * budget, and the tables whose rows changed are compared with its declaration.
 */

interface Fixture {
	db: Db;
	bank: string;
	savings: string;
	spare: string;
	bills: string;
	everyday: string;
	rent: string;
	utilities: string;
	food: string;
	fun: string;
	plain: string;
	split: string;
	transfer: string;
	market: string;
	landlord: string;
	unused: string;
	manual: string;
	auto: string;
}

const TODAY = '2026-02-01';

function scheduleInput(f: Fixture, over: Partial<ScheduleInput> = {}): ScheduleInput {
	return {
		accountId: f.bank,
		amount: -150000,
		payeeName: 'Landlord',
		categoryId: f.rent,
		startDate: '2026-01-05',
		frequency: 'monthly',
		interval: 1,
		endDate: null,
		endCount: null,
		weekend: 'keep',
		autoEnter: false,
		...over
	};
}

/** A budget with a bit of everything: accounts, plain/split/transfer transactions, schedules. */
async function fixture(): Promise<Fixture> {
	const db = await createBudgetDb();
	const base = { onBudget: true, startingDate: '2026-01-01' };
	const bank = createAccount(db, {
		...base,
		name: 'Bank',
		type: 'checking',
		startingBalance: 100000
	});
	const savings = createAccount(db, {
		...base,
		name: 'Savings',
		type: 'savings',
		startingBalance: 0
	});
	const spare = createAccount(db, { ...base, name: 'Spare', type: 'cash', startingBalance: 0 });
	const [bills, everyday] = listCategoryTree(db).filter((g) => !g.system);
	const f = {
		db,
		bank,
		savings,
		spare,
		bills: bills.id,
		everyday: everyday.id,
		rent: categoryId(db, 'Rent'),
		utilities: categoryId(db, 'Utilities'),
		food: categoryId(db, 'Food'),
		fun: categoryId(db, 'Fun')
	};
	const plain = createTransaction(db, {
		accountId: bank,
		date: '2026-01-10',
		amount: -1000,
		payeeName: 'Market',
		categoryId: f.food
	});
	const split = createTransaction(db, {
		accountId: bank,
		date: '2026-01-11',
		amount: -3000,
		payeeName: 'Market',
		splits: [
			{ categoryId: f.food, amount: -1000 },
			{ categoryId: f.fun, amount: -2000 }
		]
	});
	const transfer = createTransaction(db, {
		accountId: bank,
		date: '2026-01-12',
		amount: -500,
		transferAccountId: savings
	});
	createTransaction(db, {
		accountId: bank,
		date: '2026-01-13',
		amount: -700,
		payeeName: 'Landlord',
		categoryId: f.rent
	});
	const market = getOrCreatePayee(db, 'Market')!;
	const landlord = getOrCreatePayee(db, 'Landlord')!;
	const unused = getOrCreatePayee(db, 'Unused')!;
	setPayeeDefaultCategory(db, market, f.food);
	const fixture = { ...f, plain, split, transfer, market, landlord, unused, manual: '', auto: '' };
	fixture.manual = createSchedule(db, scheduleInput(fixture));
	fixture.auto = createSchedule(
		db,
		scheduleInput(fixture, {
			amount: -3000,
			payeeName: 'Market',
			categoryId: null,
			autoEnter: true,
			splits: [
				{ categoryId: f.food, amount: -1000 },
				{ categoryId: f.fun, amount: -2000 }
			]
		})
	);
	setAssigned(db, f.food, '2026-01', 5000);
	setAssigned(db, f.rent, '2026-01', 150000);
	return fixture;
}

interface Scenario {
	/** Runs before the snapshot, to put the budget in the state the write needs. */
	prepare?: (f: Fixture) => void;
	/** Runs on a database that holds no budget yet (creating one). */
	blank?: boolean;
	args: (f: Fixture) => unknown[];
}

const newAccount = {
	name: 'New',
	type: 'checking',
	onBudget: true,
	startingBalance: 0,
	startingDate: '2026-01-01'
};

const SCENARIOS: Record<string, Scenario[]> = {
	'meta.update': [{ args: () => [{ name: 'Renamed' }] }],
	'meta.init': [
		{
			blank: true,
			args: () => [{ name: 'Fresh', currency: 'BRL', locale: 'pt-BR', groups: [] }]
		}
	],
	'accounts.create': [
		{ args: () => [newAccount] },
		{ args: () => [{ ...newAccount, startingBalance: 5000 }] },
		{ args: (f) => [{ ...newAccount, startingBalance: 5000, startingBalanceCategoryId: f.food }] },
		{
			// The starting balance category is gone, so it is created again.
			prepare: (f) =>
				deleteCategory(f.db, startingBalanceCategoryId(f.db)!, categoryId(f.db, 'Salário')),
			args: () => [{ ...newAccount, startingBalance: 5000 }]
		}
	],
	'accounts.rename': [{ args: (f) => [f.bank, 'Main'] }],
	'accounts.close': [{ args: (f) => [f.spare] }],
	'accounts.reopen': [{ prepare: (f) => closeAccount(f.db, f.spare), args: (f) => [f.spare] }],
	'accounts.delete': [
		{ args: (f) => [f.spare] },
		{
			prepare: (f) => {
				createSchedule(
					f.db,
					scheduleInput(f, {
						accountId: f.spare,
						categoryId: null,
						splits: [
							{ categoryId: f.food, amount: -100000 },
							{ categoryId: f.fun, amount: -50000 }
						]
					})
				);
			},
			args: (f) => [f.spare]
		}
	],
	'categories.createGroup': [{ args: () => [{ name: 'Goals' }] }],
	'categories.updateGroup': [{ args: (f) => [f.bills, { name: 'Housing' }] }],
	'categories.deleteGroup': [
		{ prepare: (f) => void createGroup(f.db, { name: 'Empty' }), args: (f) => [emptyGroup(f)] },
		{ args: (f) => [f.everyday, f.bills] }
	],
	'categories.create': [{ args: (f) => [{ groupId: f.bills, name: 'Water' }] }],
	'categories.update': [{ args: (f) => [f.food, { name: 'Groceries' }] }],
	'categories.delete': [{ args: (f) => [f.food, f.fun] }, { args: (f) => [f.rent, f.utilities] }],
	'categories.saveOrder': [
		{
			args: (f) => [
				[
					{ groupId: f.everyday, categoryIds: [f.fun, f.food, f.rent] },
					{ groupId: f.bills, categoryIds: [f.utilities] }
				]
			]
		}
	],
	'payees.rename': [{ args: (f) => [f.market, 'Mercado'] }],
	'payees.merge': [{ args: (f) => [f.landlord, f.market] }],
	'payees.setDefaultCategory': [{ args: (f) => [f.landlord, f.rent] }],
	'payees.delete': [{ args: (f) => [f.unused] }],
	'payees.deleteUnused': [{ args: () => [] }],
	'transactions.create': [
		{
			args: (f) => [
				{ accountId: f.bank, date: '2026-01-20', amount: -100, payeeName: 'New', categoryId: f.fun }
			]
		},
		{
			args: (f) => [
				{
					accountId: f.bank,
					date: '2026-01-20',
					amount: -300,
					payeeName: 'Market',
					splits: [
						{ categoryId: f.food, amount: -100 },
						{ categoryId: f.fun, amount: -200 }
					]
				}
			]
		}
	],
	'transactions.update': [
		{
			args: (f) => [
				f.split,
				{
					accountId: f.bank,
					date: '2026-01-11',
					amount: -3000,
					payeeName: 'Someone',
					splits: [
						{ categoryId: f.food, amount: -2000 },
						{ categoryId: f.fun, amount: -1000 }
					]
				}
			]
		}
	],
	'transactions.delete': [{ args: (f) => [f.split] }],
	'transactions.setCleared': [{ args: (f) => [f.plain, true] }],
	'schedules.create': [
		{ args: (f) => [scheduleInput(f, { payeeName: 'Gym', categoryId: f.fun })] },
		{
			args: (f) => [
				scheduleInput(f, {
					categoryId: null,
					splits: [
						{ categoryId: f.food, amount: -100000 },
						{ categoryId: f.fun, amount: -50000 }
					]
				})
			]
		}
	],
	'schedules.update': [
		{
			args: (f) => [
				f.auto,
				scheduleInput(f, {
					amount: -3000,
					payeeName: 'Corner Shop',
					categoryId: null,
					autoEnter: true,
					splits: [
						{ categoryId: f.food, amount: -2000 },
						{ categoryId: f.fun, amount: -1000 }
					]
				})
			]
		}
	],
	'schedules.delete': [{ args: (f) => [f.auto] }],
	'schedules.enter': [
		{
			args: (f) => [
				f.manual,
				0,
				{
					accountId: f.bank,
					date: '2026-01-05',
					amount: -150000,
					payeeName: 'New Landlord',
					categoryId: f.rent
				}
			]
		},
		{
			args: (f) => [
				f.auto,
				0,
				{
					accountId: f.bank,
					date: '2026-01-05',
					amount: -3000,
					payeeName: 'Market',
					splits: [
						{ categoryId: f.food, amount: -1000 },
						{ categoryId: f.fun, amount: -2000 }
					]
				}
			]
		}
	],
	'schedules.skip': [{ args: (f) => [f.manual, 0] }],
	'schedules.enterDue': [{ args: () => [TODAY] }],
	'budget.setAssigned': [{ args: (f) => [f.fun, '2026-01', 7000] }],
	'budget.moveMoney': [
		{
			args: (f) => [{ fromCategoryId: f.food, toCategoryId: f.fun, month: '2026-01', amount: 1000 }]
		}
	],
	'budget.quickAssign': [
		{ args: (f) => [{ month: '2026-02', categoryIds: [f.food], strategy: 'last-month' }] }
	],
	'demo.create': [{ blank: true, args: () => [demoBudget('en')] }]
};

/**
 * Writes that declare every table on purpose: they create a whole budget, so everything a screen
 * shows is new, whichever tables a given budget happens to fill.
 */
const DECLARES_ALL = new Set(['meta.init', 'demo.create']);

function emptyGroup(f: Fixture): string {
	return listCategoryTree(f.db).find((g) => g.name === 'Empty')!.id;
}

type Handler = {
	kind: string;
	tables: readonly Table[];
	fn: (db: Db, ...args: unknown[]) => unknown;
};

const writes: [string, Handler][] = Object.entries(api).flatMap(([ns, group]) =>
	Object.entries(group as Record<string, Handler>)
		.filter(([, handler]) => handler.kind === 'write')
		.map(([name, handler]): [string, Handler] => [`${ns}.${name}`, handler])
);

function snapshot(db: Db): Map<Table, string> {
	return new Map(
		ALL_TABLES.map((t) => [t, JSON.stringify(all(db, `SELECT * FROM ${t} ORDER BY 1, 2`))])
	);
}

/** The tables whose rows a scenario of `method` changes. */
async function changedBy(handler: Handler, scenario: Scenario): Promise<Set<Table>> {
	const f = await fixture();
	const db = scenario.blank ? await createTestDb() : f.db;
	scenario.prepare?.(f);
	const before = snapshot(db);
	tx(db, () => handler.fn(db, ...scenario.args({ ...f, db })));
	const after = snapshot(db);
	return new Set(ALL_TABLES.filter((t) => before.get(t) !== after.get(t)));
}

describe('declared tables', () => {
	it('has a scenario for every write', () => {
		expect(writes.map(([method]) => method).filter((m) => !SCENARIOS[m])).toEqual([]);
	});

	for (const [method, handler] of writes) {
		it(`${method} declares exactly the tables it changes`, async () => {
			const changed = new Set<Table>();
			for (const scenario of SCENARIOS[method] ?? []) {
				const tables = await changedBy(handler, scenario);
				expect([...tables].filter((t) => !handler.tables.includes(t))).toEqual([]);
				for (const t of tables) changed.add(t);
			}
			if (DECLARES_ALL.has(method)) return;
			expect([...handler.tables].sort()).toEqual([...changed].sort());
		});
	}
});
