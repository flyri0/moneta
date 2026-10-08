import type { CreateAccountInput } from '$db/repos/accounts';
import type { InitBudgetInput } from '$db/repos/meta';
import type { FlagColor } from '$domain/flag';
import type { Month } from '$domain/month';

/**
 * A whole demo budget as plain data, shared by the builder on the main thread and the worker that
 * writes it. Accounts are referred to by a key and categories by name, because the builder cannot
 * know the ids the repos will hand out.
 */
export interface DemoAccountSeed extends CreateAccountInput {
	key: string;
	/** An emoji, set once the account exists. */
	icon?: string;
}

/** An emoji for a starter group or category, found by its name. */
export interface DemoIconSeed {
	name: string;
	icon: string;
}

export interface DemoSplitSeed {
	categoryName: string;
	amount: number;
	memo?: string;
}

export interface DemoTransactionSeed {
	accountKey: string;
	date: string;
	amount: number;
	payeeName?: string | null;
	categoryName?: string | null;
	memo?: string;
	cleared?: boolean;
	splits?: DemoSplitSeed[];
	transferAccountKey?: string | null;
	flag?: FlagColor;
}

/** A monthly schedule in the demo, starting on its first date after today. */
export interface DemoScheduleSeed {
	accountKey: string;
	amount: number;
	payeeName?: string | null;
	categoryName?: string | null;
	transferAccountKey?: string | null;
	startDate: string;
	autoEnter: boolean;
}

export interface DemoAssignmentSeed {
	categoryName: string;
	month: Month;
	amount: number;
}

export interface DemoSeed {
	accounts: DemoAccountSeed[];
	transactions: DemoTransactionSeed[];
	assignments: DemoAssignmentSeed[];
	schedules: DemoScheduleSeed[];
	/** The system Income group's emoji. */
	incomeGroupIcon: string;
	groupIcons: DemoIconSeed[];
	categoryIcons: DemoIconSeed[];
	/** The flags the demo renames; the others keep their color's name. */
	flagNames: { color: FlagColor; name: string }[];
}

/** A demo budget from nothing: what any budget starts with, plus what fills this one in. */
export interface DemoBudgetSeed {
	init: InitBudgetInput;
	seed: DemoSeed;
}
