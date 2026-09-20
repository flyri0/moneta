import { addMonths, monthOf, type Month } from '$domain/month';
import { READY_TO_ASSIGN, type DemoSeed, type DemoTransactionSeed } from './seed';

/** Account names for the demo, in the UI language. */
export interface DemoAccountNames {
	checking: string;
	savings: string;
	card: string;
}

/** Payee names for the demo, in the UI language. */
export interface DemoPayeeNames {
	salary: string;
	landlord: string;
	utility: string;
	telecom: string;
	insurance: string;
	grocery: string;
	transport: string;
	coffee: string;
	restaurant: string;
	household: string;
	streaming: string;
	hobby: string;
}

/** The starter categories the demo spends in, by role rather than by position. */
export interface DemoCategoryNames {
	rent: string;
	utilities: string;
	phone: string;
	insurance: string;
	groceries: string;
	transport: string;
	dining: string;
	household: string;
	emergencyFund: string;
	vacation: string;
	entertainment: string;
	hobbies: string;
}

export interface DemoInput {
	/** 'YYYY-MM-DD'. The demo covers this month and the two before it. */
	today: string;
	/** Minor units in one major unit, e.g. 100 for USD and 1 for JPY. */
	scale: number;
	accounts: DemoAccountNames;
	payees: DemoPayeeNames;
	categories: DemoCategoryNames;
}

const CHECKING = 'checking';
const SAVINGS = 'savings';
const CARD = 'card';

/** How many months of history the demo has, including the current one. */
const MONTHS = 3;

const SALARY = 3800;
const CHECKING_START = 3200;
const SAVINGS_START = 5000;
const SAVINGS_TRANSFER = 300;

/** Assigned every month. The total is exactly one paycheck, so Ready to Assign lands on zero. */
const ASSIGNED: Record<keyof DemoCategoryNames, number> = {
	rent: 1250,
	utilities: 100,
	phone: 75,
	insurance: 132,
	groceries: 600,
	transport: 125,
	dining: 150,
	household: 60,
	entertainment: 20,
	hobbies: 50,
	emergencyFund: 700,
	vacation: 538
};

/** The opening balances are income too, so the first month assigns them into the two goals. */
const FIRST_MONTH_EXTRA: Partial<Record<keyof DemoCategoryNames, number>> = {
	emergencyFund: 6000,
	vacation: 2200
};

interface Spend {
	day: number;
	account: typeof CHECKING | typeof CARD;
	payee: keyof DemoPayeeNames;
	category?: keyof DemoCategoryNames;
	amount: number;
	splits?: { category: keyof DemoCategoryNames; amount: number }[];
}

/** The same month, every month: bills from the account, everyday spending on the card. */
const SPENDING: Spend[] = [
	{ day: 3, account: CHECKING, payee: 'landlord', category: 'rent', amount: 1250 },
	{ day: 8, account: CHECKING, payee: 'utility', category: 'utilities', amount: 96.4 },
	{ day: 10, account: CHECKING, payee: 'telecom', category: 'phone', amount: 74.9 },
	{ day: 12, account: CHECKING, payee: 'insurance', category: 'insurance', amount: 132 },
	{ day: 9, account: CHECKING, payee: 'streaming', category: 'entertainment', amount: 19.9 },
	{ day: 4, account: CARD, payee: 'grocery', category: 'groceries', amount: 142.35 },
	{ day: 11, account: CARD, payee: 'grocery', category: 'groceries', amount: 118.2 },
	{ day: 18, account: CARD, payee: 'grocery', category: 'groceries', amount: 156.8 },
	{ day: 25, account: CARD, payee: 'grocery', category: 'groceries', amount: 131.05 },
	{ day: 6, account: CARD, payee: 'transport', category: 'transport', amount: 58 },
	{ day: 20, account: CARD, payee: 'transport', category: 'transport', amount: 62.5 },
	{ day: 7, account: CARD, payee: 'coffee', category: 'dining', amount: 34.6 },
	{ day: 14, account: CARD, payee: 'restaurant', category: 'dining', amount: 68.25 },
	{ day: 22, account: CARD, payee: 'coffee', category: 'dining', amount: 41.9 },
	{
		day: 16,
		account: CARD,
		payee: 'household',
		amount: 87.15,
		splits: [
			{ category: 'household', amount: 52.15 },
			{ category: 'groceries', amount: 35 }
		]
	},
	{ day: 23, account: CARD, payee: 'hobby', category: 'hobbies', amount: 45 }
];

/** What the card is paid off with on the 5th: everything charged to it the month before. */
const CARD_BILL = SPENDING.filter((s) => s.account === CARD).reduce((sum, s) => sum + s.amount, 0);

function dayOf(month: Month, day: number): string {
	return `${month}-${String(day).padStart(2, '0')}`;
}

function shiftDays(date: string, days: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const shifted = new Date(Date.UTC(y, m - 1, d + days));
	const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(shifted.getUTCDate()).padStart(2, '0');
	return `${shifted.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * A budget that looks lived in: three accounts, three months of paychecks, bills, card spending
 * and assignments, all dated from `today` so the current month is only partly spent.
 */
export function buildDemo(input: DemoInput): DemoSeed {
	const { today, scale, accounts, payees, categories } = input;
	const money = (major: number) => Math.round(major * scale);
	const current = monthOf(today);
	const first = addMonths(current, -(MONTHS - 1));
	const months = Array.from({ length: MONTHS }, (_, i) => addMonths(first, i));
	const opened = dayOf(first, 1);
	// Anything in the last few days is still waiting to clear, as it would be in a real budget.
	const pending = shiftDays(today, -3);
	const lastDay = Number(today.slice(8, 10));
	const within = (month: Month, day: number) => month !== current || day <= lastDay;

	const seed: DemoSeed = {
		accounts: [
			{
				key: CHECKING,
				name: accounts.checking,
				type: 'checking',
				onBudget: true,
				startingBalance: money(CHECKING_START),
				startingDate: opened
			},
			{
				key: SAVINGS,
				name: accounts.savings,
				type: 'savings',
				onBudget: true,
				startingBalance: money(SAVINGS_START),
				startingDate: opened
			},
			{
				key: CARD,
				name: accounts.card,
				type: 'credit_card',
				onBudget: true,
				startingBalance: 0,
				startingDate: opened
			}
		],
		transactions: [],
		assignments: []
	};

	const add = (t: DemoTransactionSeed) => {
		seed.transactions.push({ ...t, cleared: t.date <= pending });
	};

	months.forEach((month, index) => {
		if (within(month, 1)) {
			add({
				accountKey: CHECKING,
				date: dayOf(month, 1),
				amount: money(SALARY),
				payeeName: payees.salary,
				categoryName: READY_TO_ASSIGN
			});
		}
		// Nothing was charged before the first month, so there is nothing to pay off in it either.
		if (index > 0 && within(month, 5)) {
			add({
				accountKey: CHECKING,
				date: dayOf(month, 5),
				amount: -money(CARD_BILL),
				transferAccountKey: CARD
			});
		}
		if (within(month, 5)) {
			add({
				accountKey: CHECKING,
				date: dayOf(month, 5),
				amount: -money(SAVINGS_TRANSFER),
				transferAccountKey: SAVINGS
			});
		}
		for (const spend of SPENDING) {
			if (!within(month, spend.day)) continue;
			add({
				accountKey: spend.account,
				date: dayOf(month, spend.day),
				amount: -money(spend.amount),
				payeeName: payees[spend.payee],
				categoryName: spend.category ? categories[spend.category] : null,
				splits: spend.splits?.map((s) => ({
					categoryName: categories[s.category],
					amount: -money(s.amount)
				}))
			});
		}

		for (const [role, amount] of Object.entries(ASSIGNED)) {
			const key = role as keyof DemoCategoryNames;
			const extra = index === 0 ? (FIRST_MONTH_EXTRA[key] ?? 0) : 0;
			seed.assignments.push({
				categoryName: categories[key],
				month,
				amount: money(amount + extra)
			});
		}
	});

	return seed;
}
