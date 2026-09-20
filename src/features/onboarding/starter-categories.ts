export interface StarterCategory {
	name: string;
	selected: boolean;
}

export interface StarterGroup {
	name: string;
	categories: StarterCategory[];
}

/** The offered starter tree, everything picked. */
export function starterSelection(groups: { name: string; categories: string[] }[]): StarterGroup[] {
	return groups.map((group) => ({
		name: group.name,
		categories: group.categories.map((name) => ({ name, selected: true }))
	}));
}

function mapGroup(
	selection: StarterGroup[],
	groupIndex: number,
	fn: (group: StarterGroup) => StarterGroup
): StarterGroup[] {
	return selection.map((group, i) => (i === groupIndex ? fn(group) : group));
}

export function toggleCategory(
	selection: StarterGroup[],
	groupIndex: number,
	categoryIndex: number
): StarterGroup[] {
	return mapGroup(selection, groupIndex, (group) => ({
		...group,
		categories: group.categories.map((category, i) =>
			i === categoryIndex ? { ...category, selected: !category.selected } : category
		)
	}));
}

export function toggleGroup(
	selection: StarterGroup[],
	groupIndex: number,
	selected: boolean
): StarterGroup[] {
	return mapGroup(selection, groupIndex, (group) => ({
		...group,
		categories: group.categories.map((category) => ({ ...category, selected }))
	}));
}

/** Adds a category the user typed. A blank name does nothing; a name already there is just picked. */
export function addCategory(
	selection: StarterGroup[],
	groupIndex: number,
	name: string
): StarterGroup[] {
	const trimmed = name.trim();
	if (!trimmed) return selection;
	return mapGroup(selection, groupIndex, (group) => {
		const existing = group.categories.findIndex(
			(category) => category.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
		);
		if (existing !== -1) {
			return {
				...group,
				categories: group.categories.map((category, i) =>
					i === existing ? { ...category, selected: true } : category
				)
			};
		}
		return { ...group, categories: [...group.categories, { name: trimmed, selected: true }] };
	});
}

/** Unpicks everything, leaving the list in place so it can be picked from again. */
export function clearSelection(selection: StarterGroup[]): StarterGroup[] {
	return selection.map((group) => ({
		...group,
		categories: group.categories.map((category) => ({ ...category, selected: false }))
	}));
}

/** Whether the whole group is picked, which drives the group checkbox's indeterminate state. */
export function groupState(group: StarterGroup): 'all' | 'some' | 'none' {
	const picked = group.categories.filter((category) => category.selected).length;
	if (picked === 0) return 'none';
	return picked === group.categories.length ? 'all' : 'some';
}

export function selectedCount(selection: StarterGroup[]): number {
	return selection.reduce(
		(count, group) => count + group.categories.filter((category) => category.selected).length,
		0
	);
}

/** The `groups` input for `createBudget`: picked names only, groups with nothing picked left out. */
export function toGroupsInput(selection: StarterGroup[]): { name: string; categories: string[] }[] {
	return selection
		.map((group) => ({
			name: group.name,
			categories: group.categories.filter((c) => c.selected).map((c) => c.name)
		}))
		.filter((group) => group.categories.length > 0);
}
