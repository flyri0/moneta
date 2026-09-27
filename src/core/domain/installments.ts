/** The most installments a purchase can be split into. */
export const MAX_INSTALLMENTS = 99;

/**
 * Splits a positive `total` into `count` installments: every one but the first is `rest`, and
 * the first also takes the cents left over.
 */
export function splitInstallments(total: number, count: number): { first: number; rest: number } {
	const rest = Math.floor(total / count);
	return { first: total - rest * (count - 1), rest };
}

/** `memo` with the installment number, e.g. "TV 2/12". The number is the same in any language. */
export function installmentMemo(memo: string, n: number, total: number): string {
	const label = `${n}/${total}`;
	const trimmed = memo.trim();
	return trimmed ? `${trimmed} ${label}` : label;
}

/**
 * The memo a schedule gives occurrence `index`: numbered when it pays a purchase in installments
 * (`installmentStart` is the number of occurrence 0).
 */
export function occurrenceMemo(
	s: { memo: string; installmentStart: number | null; endCount: number | null },
	index: number
): string {
	if (s.installmentStart === null || s.endCount === null) return s.memo;
	return installmentMemo(s.memo, s.installmentStart + index, s.installmentStart + s.endCount - 1);
}
