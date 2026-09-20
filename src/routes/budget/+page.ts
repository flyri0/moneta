import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { currentMonth } from '$domain/month';

export function load() {
	redirect(307, resolve('/budget/[month]', { month: currentMonth() }));
}
