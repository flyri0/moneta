import type { AvailableTone } from '$features/budget/view';

/** The Available pill's tint, per tone. */
export const TONE_PILL: Record<AvailableTone, string> = {
	positive: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
	zero: 'bg-muted text-muted-foreground',
	carryover: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
	overspent: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
};

/** The spending bar's fill, per tone, so a card agrees with its pill. */
export const TONE_BAR: Record<AvailableTone, string> = {
	positive: 'bg-emerald-500 dark:bg-emerald-400',
	zero: 'bg-muted-foreground',
	carryover: 'bg-amber-500 dark:bg-amber-400',
	overspent: 'bg-red-500 dark:bg-red-400'
};
