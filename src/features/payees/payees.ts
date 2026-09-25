import type { Payee } from '$db/repos/payees';

/** Lowercase without accents, so "sao joao" finds "São João". */
function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLocaleLowerCase()
		.trim();
}

/** The payees whose name contains `query`, ignoring case and accents. */
export function filterPayees(payees: Payee[], query: string): Payee[] {
	const q = fold(query);
	if (!q) return payees;
	return payees.filter((p) => fold(p.name).includes(q));
}

/** Lowercase for ASCII letters only, like SQLite's NOCASE, which the payee names are unique under. */
function nocase(text: string): string {
	return text.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** Another payee that already has the name `name`, which a rename would collide with. */
export function nameConflict(payees: Payee[], id: string, name: string): Payee | null {
	const wanted = nocase(name);
	if (!wanted) return null;
	return payees.find((p) => p.id !== id && nocase(p.name) === wanted) ?? null;
}

/** The payees `id` can be merged into. */
export function mergeTargets(payees: Payee[], id: string): Payee[] {
	return payees.filter((p) => p.id !== id);
}

/** Whether any transaction or schedule uses the payee. */
export function inUse(payee: Pick<Payee, 'transactions' | 'schedules'>): boolean {
	return payee.transactions > 0 || payee.schedules > 0;
}

/** How many payees "Remove unused" would delete. */
export function unusedCount(payees: Payee[]): number {
	return payees.filter((p) => !inUse(p)).length;
}
