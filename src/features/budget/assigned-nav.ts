/** The item `step` places after (or, negative, before) `current`; none past either end. */
export function neighbor<T>(items: readonly T[], current: T, step: 1 | -1): T | undefined {
	const at = items.indexOf(current);
	return at < 0 ? undefined : items[at + step];
}
