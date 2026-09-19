import { all, type Db } from '../connection';

export interface Category {
	id: string;
	name: string;
	system: string | null;
}

export interface CategoryGroup {
	id: string;
	name: string;
	system: string | null;
	categories: Category[];
}

export function listCategoryTree(db: Db): CategoryGroup[] {
	const groups = all<{ id: string; name: string; system: string | null }>(
		db,
		'SELECT id, name, system FROM category_groups ORDER BY sort_order'
	);

	return groups.map((group) => {
		const categories = all<{ id: string; name: string; system: string | null }>(
			db,
			'SELECT id, name, system FROM categories WHERE group_id = ? ORDER BY sort_order',
			[group.id]
		);

		return {
			id: group.id,
			name: group.name,
			system: group.system,
			categories
		};
	});
}
