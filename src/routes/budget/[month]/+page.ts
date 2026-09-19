import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { currentMonth, isMonth } from '$lib/domain/month';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!isMonth(params.month)) redirect(307, resolve('/budget/[month]', { month: currentMonth() }));
	return { month: params.month };
};
