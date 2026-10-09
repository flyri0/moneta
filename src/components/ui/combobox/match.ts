/** Whether `query` names one of `items` exactly, by value or by label, ignoring case. */
export function hasExactMatch(items: { value: string; label: string }[], query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return false;
	return items.some((i) => i.value.toLowerCase() === q || i.label.toLowerCase() === q);
}
