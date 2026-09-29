import type { GroupNode } from '$db/repos/categories';

/** A group as the pickers list it: the category tree's and a budget month's both fit. */
export interface PickerGroup {
	id: string;
	name: string;
	system: GroupNode['system'];
	hidden?: boolean;
}

/** A group with the categories a picker can offer from it. */
export interface PickerTreeGroup extends PickerGroup {
	categories: { id: string; name: string; hidden?: boolean }[];
}
