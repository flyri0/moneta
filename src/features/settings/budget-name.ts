/** The budget name to save, trimmed, or null when nothing but spaces was typed. */
export function budgetName(text: string): string | null {
	const trimmed = text.trim();
	return trimmed === '' ? null : trimmed;
}
