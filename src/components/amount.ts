/** An amount's color, from its sign alone: income below zero must not look like money coming in. */
export type AmountTone = 'inflow' | 'zero' | 'outflow';

export function amountTone(amount: number): AmountTone {
	if (amount > 0) return 'inflow';
	return amount < 0 ? 'outflow' : 'zero';
}

/** A flow's text, the same everywhere: green for money in, the text's own color for money out. */
export const AMOUNT_TEXT: Record<AmountTone, string> = {
	inflow: 'text-emerald-700 dark:text-emerald-400',
	zero: 'text-muted-foreground',
	outflow: ''
};
