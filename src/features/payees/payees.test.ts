import { describe, it, expect } from 'vitest';
import type { Payee } from '$db/repos/payees';
import { filterPayees, mergeTargets, nameConflict, unusedCount } from './payees';

const payee = (id: string, name: string, transactions = 1, schedules = 0): Payee => ({
	id,
	name,
	defaultCategoryId: null,
	lastCategoryId: null,
	transactions,
	schedules,
	lastUsed: transactions ? '2026-01-01' : null
});

const list = [
	payee('a', 'Amazon'),
	payee('b', 'Padaria São João', 0),
	payee('c', 'Starting Balance'),
	payee('d', 'Old shop', 0),
	payee('e', 'Saldo inicial', 0)
];

describe('filterPayees', () => {
	it('matches the name, ignoring case and accents', () => {
		expect(filterPayees(list, 'sao joao').map((p) => p.id)).toEqual(['b']);
		expect(filterPayees(list, ' AMA ').map((p) => p.id)).toEqual(['a']);
		expect(filterPayees(list, 'saldo').map((p) => p.id)).toEqual(['e']);
	});

	it('returns everything for an empty query', () => {
		expect(filterPayees(list, '  ')).toBe(list);
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
	it('offers every other payee, starting balance names included', () => {
		expect(mergeTargets(list, 'a').map((p) => p.id)).toEqual(['b', 'c', 'd', 'e']);
	});
});

describe('unusedCount', () => {
	it('counts payees without transactions, starting balance names included', () => {
		expect(unusedCount(list)).toBe(3);
	});
});

describe('unusedCount with schedules', () => {
	it('does not count a payee that a schedule uses', () => {
		expect(unusedCount([payee('a', 'Rent', 0, 1), payee('b', 'Old', 0)])).toBe(1);
	});
});
