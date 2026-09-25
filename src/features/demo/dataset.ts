import { addMonths, monthOf, type Month } from '$domain/month';
import type { DemoSeed, DemoTransactionSeed } from './seed';

/** Account names for the demo, in the UI language. */
export interface DemoAccountNames {
	checking: string;
	savings: string;
	card: string;
}

/** Payee names for the demo, in the UI language. */
export interface DemoPayeeNames {
	salary: string;
	newEmployer: string;
	freelance: string;
	benefits: string;
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
	mechanic: string;
	airline: string;
	hotel: string;
	pharmacy: string;
	clinic: string;
}

/** The categories the demo uses, by role rather than by position. */
export interface DemoCategoryNames {
	salary: string;
	otherIncome: string;
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
	/** 'YYYY-MM-DD'. The demo covers this month and the eleven before it. */
	today: string;
	/** Minor units in one major unit, e.g. 100 for USD and 1 for JPY. */
	scale: number;
	accounts: DemoAccountNames;
	payees: DemoPayeeNames;
	categories: DemoCategoryNames;
}

type Income = 'salary' | 'otherIncome';
type Budgeted = Exclude<keyof DemoCategoryNames, Income>;

const BUDGETED: Budgeted[] = [
	'rent',
	'utilities',
	'phone',
	'insurance',
	'groceries',
	'transport',
	'dining',
	'household',
	'emergencyFund',
	'vacation',
	'entertainment',
	'hobbies'
];

const CHECKING = 'checking';
const SAVINGS = 'savings';
const CARD = 'card';

const CHECKING_START = 3200;
const SAVINGS_START = 5000;
const RENT = 1250;
/** The checking account is topped up from savings before a month would take it below this. */
const CHECKING_FLOOR = 1000;
/** Top-ups from savings are rounded up to this. */
const TOP_UP_STEP = 100;

interface Spend {
	day: number;
	account: typeof CHECKING | typeof CARD;
	payee: keyof DemoPayeeNames;
	category?: Budgeted;
	amount: number;
	splits?: { category: Budgeted; amount: number }[];
	/** Changes a little every month, unlike a fixed bill. */
	varies?: boolean;
}

/** An ordinary month: bills from the account, everyday spending on the card. */
const EVERY_MONTH: Spend[] = [
	{ day: 3, account: CHECKING, payee: 'landlord', category: 'rent', amount: RENT },
	{
		day: 8,
		account: CHECKING,
		payee: 'utility',
		category: 'utilities',
		amount: 96.4,
		varies: true
	},
	{ day: 10, account: CHECKING, payee: 'telecom', category: 'phone', amount: 74.9 },
	{ day: 12, account: CHECKING, payee: 'insurance', category: 'insurance', amount: 132 },
	{ day: 9, account: CHECKING, payee: 'streaming', category: 'entertainment', amount: 19.9 },
	{ day: 4, account: CARD, payee: 'grocery', category: 'groceries', amount: 142.35, varies: true },
	{ day: 11, account: CARD, payee: 'grocery', category: 'groceries', amount: 118.2, varies: true },
	{ day: 18, account: CARD, payee: 'grocery', category: 'groceries', amount: 156.8, varies: true },
	{ day: 25, account: CARD, payee: 'grocery', category: 'groceries', amount: 131.05, varies: true },
	{ day: 6, account: CARD, payee: 'transport', category: 'transport', amount: 58, varies: true },
	{ day: 20, account: CARD, payee: 'transport', category: 'transport', amount: 62.5, varies: true },
	{ day: 7, account: CARD, payee: 'coffee', category: 'dining', amount: 34.6, varies: true },
	{ day: 14, account: CARD, payee: 'restaurant', category: 'dining', amount: 68.25, varies: true },
	{ day: 22, account: CARD, payee: 'coffee', category: 'dining', amount: 41.9, varies: true },
	{
		day: 16,
		account: CARD,
		payee: 'household',
		amount: 87.15,
		splits: [
			{ category: 'household', amount: 52.15 },
			{ category: 'groceries', amount: 35 }
		],
		varies: true
	},
	{ day: 23, account: CARD, payee: 'hobby', category: 'hobbies', amount: 45, varies: true }
];

type Phase = 'rise' | 'crisis' | 'recovery';

/** Of what is left once every category is funded, the share that goes to the emergency fund. */
const EMERGENCY_SHARE: Record<Phase, number> = { rise: 0.6, crisis: 1, recovery: 0.8 };

interface Earning {
	day: number;
	payee: keyof DemoPayeeNames;
	category: Income;
	amount: number;
}

/**
 * How the card is paid on the 5th: the whole balance, a fixed amount, or last month's charges
 * plus something toward the debt. Never more than what is owed.
 */
type CardPayment = 'full' | { fixed: number } | { extra: number };

interface Chapter {
	phase: Phase;
	earnings: Earning[];
	/** Moved to savings on the 5th. */
	savings: number;
	card: CardPayment;
	/** Everyday spending as a share of the usual, by category; 0 drops it. */
	pace?: Partial<Record<Budgeted, number>>;
	extras?: Spend[];
}

const paycheck = (amount: number, day = 1): Earning => ({
	day,
	payee: 'salary',
	category: 'salary',
	amount
});
const newPaycheck = (amount: number, day = 1): Earning => ({
	day,
	payee: 'newEmployer',
	category: 'salary',
	amount
});
const freelance = (amount: number, day: number): Earning => ({
	day,
	payee: 'freelance',
	category: 'otherIncome',
	amount
});
const benefits = (amount: number): Earning => ({
	day: 10,
	payee: 'benefits',
	category: 'otherIncome',
	amount
});
const tightened: Partial<Record<Budgeted, number>> = {
	groceries: 0.8,
	transport: 0.7,
	dining: 0.15,
	household: 0.5,
	hobbies: 0,
	entertainment: 0
};

/**
 * A year, oldest month first: raises and a side gig, then a layoff that the emergency fund and the
 * card absorb, then a new job that pays less and a debt that shrinks a little every month. The
 * last chapter is the current month.
 */
const STORY: Chapter[] = [
	{
		phase: 'rise',
		earnings: [paycheck(3800), freelance(350, 18)],
		savings: 1500,
		card: 'full'
	},
	{
		phase: 'rise',
		earnings: [paycheck(3800), freelance(600, 20)],
		savings: 2000,
		card: 'full',
		pace: { dining: 1.1 }
	},
	{
		phase: 'rise',
		earnings: [paycheck(4400), freelance(500, 17)],
		savings: 2500,
		card: 'full',
		pace: { dining: 1.2, hobbies: 1.3 }
	},
	{
		phase: 'rise',
		earnings: [paycheck(4400), paycheck(2500, 15), freelance(900, 22)],
		savings: 4500,
		card: 'full',
		pace: { dining: 1.4, hobbies: 1.5, household: 1.2 },
		extras: [{ day: 9, account: CARD, payee: 'household', category: 'household', amount: 420 }]
	},
	{
		phase: 'rise',
		earnings: [paycheck(5600), freelance(700, 19)],
		savings: 5000,
		card: 'full',
		pace: { dining: 1.5, hobbies: 1.6, groceries: 1.05 },
		extras: [
			{ day: 8, account: CARD, payee: 'airline', category: 'vacation', amount: 1150 },
			{ day: 24, account: CARD, payee: 'hotel', category: 'vacation', amount: 890 }
		]
	},
	{
		phase: 'crisis',
		// Laid off: half a month's pay, then the severance.
		earnings: [paycheck(1300), paycheck(1800, 20)],
		savings: 0,
		card: 'full',
		pace: { dining: 0.8, hobbies: 0.5 },
		extras: [{ day: 12, account: CARD, payee: 'mechanic', category: 'emergencyFund', amount: 2150 }]
	},
	{
		phase: 'crisis',
		earnings: [benefits(1400)],
		savings: 0,
		card: { fixed: 250 },
		pace: tightened,
		extras: [{ day: 14, account: CARD, payee: 'clinic', category: 'emergencyFund', amount: 640 }]
	},
	{
		phase: 'crisis',
		earnings: [benefits(1400), freelance(250, 24)],
		savings: 0,
		card: { fixed: 300 },
		pace: { ...tightened, transport: 0.75, dining: 0.2 },
		extras: [{ day: 9, account: CARD, payee: 'pharmacy', category: 'emergencyFund', amount: 85 }]
	},
	{
		phase: 'recovery',
		// The new job starts mid-month, with the last of the benefits.
		earnings: [benefits(1400), newPaycheck(1500, 15)],
		savings: 0,
		card: { extra: 250 },
		pace: { groceries: 0.85, dining: 0.3, household: 0.7, hobbies: 0.2, entertainment: 0 }
	},
	{
		phase: 'recovery',
		earnings: [newPaycheck(3000)],
		savings: 100,
		card: { extra: 350 },
		pace: { groceries: 0.9, dining: 0.4, household: 0.8, hobbies: 0.3, entertainment: 0 }
	},
	{
		phase: 'recovery',
		earnings: [newPaycheck(3000), freelance(250, 21)],
		savings: 150,
		card: { extra: 450 },
		pace: { groceries: 0.95, dining: 0.5, household: 0.9, hobbies: 0.4 }
	},
	{
		phase: 'recovery',
		earnings: [newPaycheck(3200)],
		savings: 200,
		card: { extra: 500 },
		pace: { dining: 0.6, hobbies: 0.5 }
	}
];

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

/** A small seeded PRNG (mulberry32), so the demo varies from month to month but never between runs. */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A month's spending in minor units, after the chapter's pace and a little noise. */
interface Charge {
	day: number;
	account: typeof CHECKING | typeof CARD;
	payee: keyof DemoPayeeNames;
	category?: Budgeted;
	amount: number;
	splits?: { category: Budgeted; amount: number }[];
}

/**
 * A lived-in budget: three accounts and a year of paychecks, bills, card spending and assignments,
 * all dated from `today` so the current month is only partly spent. The year has a shape: things
 * get better, then much worse, then slowly better again.
 */
export function buildDemo(input: DemoInput): DemoSeed {
	const { today, scale, accounts, payees, categories } = input;
	const money = (major: number) => Math.round(major * scale);
	const current = monthOf(today);
	const first = addMonths(current, -(STORY.length - 1));
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
		assignments: [],
		schedules: []
	};

	const add = (t: DemoTransactionSeed) => {
		seed.transactions.push({ ...t, cleared: t.date <= pending });
	};

	// What the generator keeps track of from one month to the next, like the budget screen would.
	let checking = money(CHECKING_START);
	let card = 0;
	let lastCharges = 0;
	let cardPayment = 0;
	const available = new Map<Budgeted, number>(BUDGETED.map((c) => [c, 0]));

	STORY.forEach((chapter, index) => {
		const month = addMonths(first, index);
		const noise = random(index + 1);
		const scaled = (spend: Spend, category: Budgeted, amount: number) =>
			money(amount * (chapter.pace?.[category] ?? 1) * (spend.varies ? 0.85 + 0.3 * noise() : 1));

		const charges: Charge[] = [];
		for (const spend of [...EVERY_MONTH, ...(chapter.extras ?? [])]) {
			if (spend.splits) {
				const splits = spend.splits.map((s) => ({
					category: s.category,
					amount: scaled(spend, s.category, s.amount)
				}));
				if (splits.some((s) => s.amount === 0)) continue;
				const amount = splits.reduce((sum, s) => sum + s.amount, 0);
				charges.push({ ...spend, amount, splits });
			} else {
				const amount = scaled(spend, spend.category!, spend.amount);
				if (amount > 0) charges.push({ ...spend, amount });
			}
		}

		const statement = -card;
		const plan = chapter.card;
		cardPayment = Math.min(
			statement,
			plan === 'full'
				? statement
				: 'fixed' in plan
					? money(plan.fixed)
					: lastCharges + money(plan.extra)
		);
		const savings = money(chapter.savings);
		const earnings = chapter.earnings.map((e) => ({ ...e, amount: money(e.amount) }));

		// The checking account over the month, to see whether it needs money from savings first.
		const flows: [number, number][] = [
			...earnings.map((e): [number, number] => [e.day, e.amount]),
			...charges
				.filter((c) => c.account === CHECKING)
				.map((c): [number, number] => [c.day, -c.amount]),
			[5, -cardPayment - savings]
		];
		flows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		let running = checking;
		let lowest = checking;
		for (const [, amount] of flows) {
			running += amount;
			lowest = Math.min(lowest, running);
		}
		const step = money(TOP_UP_STEP);
		const shortfall = money(CHECKING_FLOOR) - lowest;
		const topUp = shortfall > 0 ? Math.ceil(shortfall / step) * step : 0;
		checking = running + topUp;

		for (const e of earnings) {
			if (!within(month, e.day)) continue;
			add({
				accountKey: CHECKING,
				date: dayOf(month, e.day),
				amount: e.amount,
				payeeName: payees[e.payee],
				categoryName: categories[e.category]
			});
		}
		if (topUp > 0 && within(month, 2)) {
			add({
				accountKey: CHECKING,
				date: dayOf(month, 2),
				amount: topUp,
				transferAccountKey: SAVINGS
			});
		}
		if (cardPayment > 0 && within(month, 5)) {
			add({
				accountKey: CHECKING,
				date: dayOf(month, 5),
				amount: -cardPayment,
				transferAccountKey: CARD
			});
		}
		if (savings > 0 && within(month, 5)) {
			add({
				accountKey: CHECKING,
				date: dayOf(month, 5),
				amount: -savings,
				transferAccountKey: SAVINGS
			});
		}
		for (const charge of charges) {
			if (!within(month, charge.day)) continue;
			add({
				accountKey: charge.account,
				date: dayOf(month, charge.day),
				amount: -charge.amount,
				payeeName: payees[charge.payee],
				categoryName: charge.category && !charge.splits ? categories[charge.category] : null,
				splits: charge.splits?.map((s) => ({
					categoryName: categories[s.category],
					amount: -s.amount
				}))
			});
		}

		const charged = charges.filter((c) => c.account === CARD).reduce((sum, c) => sum + c.amount, 0);
		card += cardPayment - charged;
		lastCharges = charged;

		// Envelopes: every category gets what the month will spend in it, and whatever is left
		// goes to the goals. When the month has less than it needs, the goals give some back.
		const spent = new Map<Budgeted, number>(BUDGETED.map((c) => [c, 0]));
		for (const charge of charges) {
			for (const part of charge.splits ?? [{ category: charge.category!, amount: charge.amount }]) {
				spent.set(part.category, spent.get(part.category)! + part.amount);
			}
		}
		const assigned = new Map<Budgeted, number>(
			BUDGETED.map((c) => [c, Math.max(0, spent.get(c)! - available.get(c)!)])
		);
		const income = earnings
			.filter((e) => within(month, e.day))
			.reduce((sum, e) => sum + e.amount, 0);
		const opening = index === 0 ? money(CHECKING_START + SAVINGS_START) : 0;
		let rest = income + opening - [...assigned.values()].reduce((sum, a) => sum + a, 0);
		if (rest >= 0) {
			const emergency = Math.round(rest * EMERGENCY_SHARE[chapter.phase]);
			assigned.set('emergencyFund', assigned.get('emergencyFund')! + emergency);
			assigned.set('vacation', assigned.get('vacation')! + rest - emergency);
		} else {
			for (const goal of ['emergencyFund', 'vacation'] as const) {
				const spare = available.get(goal)! + assigned.get(goal)! - spent.get(goal)!;
				const taken = Math.min(spare, -rest);
				assigned.set(goal, assigned.get(goal)! - taken);
				rest += taken;
			}
			if (rest < 0) throw new Error(`The demo spends more than it has in ${month}`);
		}
		for (const category of BUDGETED) {
			const amount = assigned.get(category)!;
			available.set(category, available.get(category)! + amount - spent.get(category)!);
			if (amount !== 0)
				seed.assignments.push({ categoryName: categories[category], month, amount });
		}
	});

	// The next paycheck, rent and card payment as schedules, on their first date after today.
	const upcoming = (day: number) => dayOf(day > lastDay ? current : addMonths(current, 1), day);
	const salary = STORY.at(-1)!.earnings[0];
	seed.schedules.push(
		{
			accountKey: CHECKING,
			amount: money(salary.amount),
			payeeName: payees[salary.payee],
			categoryName: categories[salary.category],
			startDate: upcoming(salary.day),
			autoEnter: true
		},
		{
			accountKey: CHECKING,
			amount: -money(RENT),
			payeeName: payees.landlord,
			categoryName: categories.rent,
			startDate: upcoming(3),
			autoEnter: false
		},
		{
			accountKey: CHECKING,
			amount: -cardPayment,
			transferAccountKey: CARD,
			startDate: upcoming(5),
			autoEnter: false
		}
	);

	return seed;
}
