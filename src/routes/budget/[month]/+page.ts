import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { currentMonth, isBudgetMonth } from '$domain/month';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!isBudgetMonth(params.month))
		redirect(307, resolve('/budget/[month]', { month: currentMonth() }));
	return { month: params.month };
};
