import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { endDemo } from '$client/demo';
import { isStandalone } from '$client/install';
import { shouldShowWelcome } from '$client/welcome';
import { currentMonth } from '$domain/month';

export function load() {
	// Coming back here ends the demo. The file goes on the next start: this page has no worker.
	endDemo(localStorage);
	if (shouldShowWelcome(localStorage, isStandalone())) return;
	redirect(307, resolve('/budget/[month]', { month: currentMonth() }));
}
