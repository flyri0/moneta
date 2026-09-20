import type { KeyValueStore } from '$lib/client/registry';

const PREFIX = 'moneta.collapsed.';

/** Where a budget file's collapsed groups are stored. */
export function collapsedKey(file: string): string {
	return PREFIX + file;
}

/** The groups folded shut in `file`'s grid. A convenience, so an unreadable store means none. */
export function loadCollapsed(store: KeyValueStore, file: string): Set<string> {
	try {
		const raw: unknown = JSON.parse(store.getItem(collapsedKey(file)) ?? 'null');
		if (!Array.isArray(raw)) return new Set();
		return new Set(raw.filter((id): id is string => typeof id === 'string'));
	} catch {
		return new Set();
	}
}

/** Remembers `collapsed` for `file`. Storage can be full or blocked, so failures are ignored. */
export function saveCollapsed(
	store: KeyValueStore,
	file: string,
	collapsed: ReadonlySet<string>
): void {
	try {
		store.setItem(collapsedKey(file), JSON.stringify([...collapsed]));
	} catch {
		// Only a convenience.
	}
}

/** Folds `id` shut, or opens it again. Returns a new set. */
export function toggleCollapsed(collapsed: ReadonlySet<string>, id: string): Set<string> {
	const next = new Set(collapsed);
	if (!next.delete(id)) next.add(id);
	return next;
}

/** Whether every group on screen is collapsed. An empty grid counts as expanded. */
export function allCollapsed(
	groups: readonly { id: string }[],
	collapsed: ReadonlySet<string>
): boolean {
	return groups.length > 0 && groups.every((g) => collapsed.has(g.id));
}

/** Collapses every group, or expands them all when they already are. Forgets stale ids. */
export function toggleAll(
	groups: readonly { id: string }[],
	collapsed: ReadonlySet<string>
): Set<string> {
	return allCollapsed(groups, collapsed) ? new Set() : new Set(groups.map((g) => g.id));
}
