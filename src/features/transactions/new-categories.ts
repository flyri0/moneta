import type { ClientApi } from '$db/api';
import { foldText } from '$domain/search';

/** Where a new category goes: an existing group, or a new one by name. */
export type NewCategoryGroup = { id: string } | { name: string };

interface Pending {
	token: string;
	name: string;
	group: NewCategoryGroup;
	/** The category's id once created. */
	id: string | null;
}

const PREFIX = 'new-category:';

/** The part of the API that creates categories. */
export type CreatesCategories = { categories: Pick<ClientApi['categories'], 'createIn'> };

/**
 * Categories (and groups) picked in a form but not created yet. A picker's value holds a token
 * for each one; saving the form creates them (`resolve`) and swaps the tokens for their ids.
 */
export class NewCategories {
	#pending: Pending[] = [];
	/** New groups already created, by folded name. */
	#groups = new Map<string, string>();

	/** The token for a category named `name` in `group`, the same one when picked again. */
	add(name: string, group: NewCategoryGroup): string {
		const trimmed = name.trim();
		const found = this.#pending.find(
			(p) => foldText(p.name) === foldText(trimmed) && sameGroup(p.group, group)
		);
		if (found) return found.token;
		const token = `${PREFIX}${this.#pending.length + 1}`;
		this.#pending.push({ token, name: trimmed, group, id: null });
		return token;
	}

	/** Whether `value` is a token for a category not created yet. */
	static isToken(value: string | null | undefined): boolean {
		return !!value?.startsWith(PREFIX);
	}

	/** A token's name, with its new group's (`{ group }` in `format`) when the group is new too. */
	label(token: string, format: (category: string, group: string) => string): string | null {
		const pending = this.#pending.find((p) => p.token === token);
		if (!pending) return null;
		return 'name' in pending.group ? format(pending.name, pending.group.name) : pending.name;
	}

	/**
	 * Creates the categories behind the tokens among `values`, once each, and returns their ids by
	 * token. A new group is created with its first category and reused by the next ones. After a
	 * failure, calling it again creates only what is still missing.
	 */
	async resolve(
		api: CreatesCategories,
		values: (string | null | undefined)[]
	): Promise<Map<string, string>> {
		const ids = new Map<string, string>();
		for (const value of new Set(values)) {
			const pending = this.#pending.find((p) => p.token === value);
			if (!pending) continue;
			if (pending.id === null) {
				const key = 'name' in pending.group ? foldText(pending.group.name.trim()) : null;
				const known = key === null ? undefined : this.#groups.get(key);
				const group = known ? { id: known } : pending.group;
				const created = await api.categories.createIn({ name: pending.name, group });
				pending.id = created.categoryId;
				if (key !== null) this.#groups.set(key, created.groupId);
			}
			ids.set(pending.token, pending.id);
		}
		return ids;
	}
}

function sameGroup(a: NewCategoryGroup, b: NewCategoryGroup): boolean {
	if ('id' in a) return 'id' in b && a.id === b.id;
	return 'name' in b && foldText(a.name.trim()) === foldText(b.name.trim());
}

/** Every category value an input uses: its own and its split lines'. */
export function categoryValues(input: {
	categoryId?: string | null;
	splits?: { categoryId: string }[];
}): (string | null | undefined)[] {
	return [input.categoryId, ...(input.splits ?? []).map((s) => s.categoryId)];
}

/** `input` with each token swapped for the id `ids` gives it. */
export function withCategoryIds<
	T extends { categoryId?: string | null; splits?: { categoryId: string }[] }
>(input: T, ids: Map<string, string>): T {
	const swap = (id: string) => ids.get(id) ?? id;
	return {
		...input,
		...(input.categoryId ? { categoryId: swap(input.categoryId) } : {}),
		...(input.splits
			? { splits: input.splits.map((s) => ({ ...s, categoryId: swap(s.categoryId) })) }
			: {})
	};
}
