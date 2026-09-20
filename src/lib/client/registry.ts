import { uuidv7 } from 'uuidv7';

/**
 * The list of budget files and the one opened last. It is a cache: file names come from the
 * worker's OPFS pool and budget names from each file's meta, so it can always be rebuilt.
 */
export interface BudgetEntry {
	file: string;
	name: string;
}

export interface Registry {
	budgets: BudgetEntry[];
	lastOpened: string | null;
}

/** The subset of Storage the registry needs (localStorage in the app, a Map-backed fake in tests). */
export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export const REGISTRY_KEY = 'moneta.registry';
const BUDGET_FILE = /^budget-[0-9a-f-]+\.sqlite3$/;

export function newBudgetFile(id: string = uuidv7()): string {
	return `budget-${id}.sqlite3`;
}

export function isBudgetFile(file: string): boolean {
	return BUDGET_FILE.test(file);
}

const EMPTY: Registry = { budgets: [], lastOpened: null };

export function loadRegistry(store: KeyValueStore): Registry {
	try {
		const raw = JSON.parse(store.getItem(REGISTRY_KEY) ?? 'null') as Partial<Registry> | null;
		const budgets = Array.isArray(raw?.budgets)
			? raw.budgets.filter(
					(b): b is BudgetEntry =>
						typeof b?.file === 'string' && typeof b?.name === 'string' && isBudgetFile(b.file)
				)
			: [];
		const lastOpened = typeof raw?.lastOpened === 'string' ? raw.lastOpened : null;
		return { budgets, lastOpened };
	} catch {
		return EMPTY;
	}
}

export function saveRegistry(store: KeyValueStore, registry: Registry): void {
	try {
		store.setItem(REGISTRY_KEY, JSON.stringify(registry));
	} catch {
		// Storage can be full or blocked; the registry is rebuilt from the files next time.
	}
}

/**
 * Drops entries whose file no longer exists and lists budget files the registry doesn't know
 * (they need their name read from the file). Files that aren't budgets are ignored.
 */
export function reconcile(
	registry: Registry,
	files: string[]
): { registry: Registry; unnamed: string[] } {
	const existing = new Set(files.filter(isBudgetFile));
	const budgets = registry.budgets.filter((b) => existing.has(b.file));
	const known = new Set(budgets.map((b) => b.file));
	const lastOpened =
		registry.lastOpened && existing.has(registry.lastOpened) ? registry.lastOpened : null;
	return {
		registry: { budgets, lastOpened },
		unnamed: [...existing].filter((f) => !known.has(f)).sort()
	};
}

/** The budget to open: the last one used if it still exists, else the first listed. */
export function pickBudget(registry: Registry): string | null {
	if (registry.lastOpened && registry.budgets.some((b) => b.file === registry.lastOpened))
		return registry.lastOpened;
	return registry.budgets[0]?.file ?? null;
}

export function upsertBudget(registry: Registry, entry: BudgetEntry): Registry {
	const found = registry.budgets.some((b) => b.file === entry.file);
	return {
		...registry,
		budgets: found
			? registry.budgets.map((b) => (b.file === entry.file ? entry : b))
			: [...registry.budgets, entry]
	};
}

export function markOpened(registry: Registry, file: string): Registry {
	return { ...registry, lastOpened: file };
}

export function removeBudget(registry: Registry, file: string): Registry {
	return {
		budgets: registry.budgets.filter((b) => b.file !== file),
		lastOpened: registry.lastOpened === file ? null : registry.lastOpened
	};
}
