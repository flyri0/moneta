import { describe, it, expect } from 'vitest';
import type { Payee } from '$db/repos/payees';
import { editable, filterPayees, mergeTargets, nameConflict, unusedCount } from './payees';

const payee = (id: string, name: string, transactions = 1): Payee => ({
	id,
	name,
	defaultCategoryId: null,
	lastCategoryId: null,
	transactions,
	lastUsed: transactions ? '2026-01-01' : null
});

const list = [
	payee('a', 'Amazon'),
	payee('b', 'Padaria São João', 0),
	payee('c', 'Starting Balance'),
	payee('d', 'Old shop', 0),
	payee('e', 'Saldo inicial', 0)
];

describe('editable', () => {
	it('leaves starting balance payees read-only', () => {
		expect(editable(payee('a', 'Amazon'))).toBe(true);
		expect(editable(payee('c', 'Starting Balance'))).toBe(false);
	});
});

describe('filterPayees', () => {
	const label = (p: Payee) => (p.id === 'c' ? 'Saldo inicial' : p.name);

	it('matches the shown name, ignoring case and accents', () => {
		expect(filterPayees(list, 'sao joao', label).map((p) => p.id)).toEqual(['b']);
		expect(filterPayees(list, ' AMA ', label).map((p) => p.id)).toEqual(['a']);
		expect(filterPayees(list, 'saldo', label).map((p) => p.id)).toEqual(['c', 'e']);
	});

	it('returns everything for an empty query', () => {
		expect(filterPayees(list, '  ', label)).toBe(list);
	});
});

describe('nameConflict', () => {
	it('finds another payee with the typed name, like the database does', () => {
		expect(nameConflict(list, 'd', ' amazon ')?.id).toBe('a');
		expect(nameConflict(list, 'a', 'AMAZON')).toBeNull();
		expect(nameConflict(list, 'a', 'Something new')).toBeNull();
		expect(nameConflict(list, 'a', '')).toBeNull();
	});
});

describe('mergeTargets', () => {
	it('offers the other editable payees', () => {
		expect(mergeTargets(list, 'a').map((p) => p.id)).toEqual(['b', 'd']);
	});
});

describe('unusedCount', () => {
	it('counts editable payees without transactions', () => {
		expect(unusedCount(list)).toBe(2);
	});
});
