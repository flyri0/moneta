import { describe, expect, it } from 'vitest';
import { changedFlagNames, flagFilterLabel, flagLabel, toggleFlag } from './flags';

const flags = [
	{ color: 'red' as const, name: 'Reimbursable' },
	{ color: 'blue' as const, name: null }
];

describe('flagLabel', () => {
	it('is the name the user gave it, or its color', () => {
		expect(flagLabel('red', flags)).toBe('Reimbursable');
		expect(flagLabel('blue', flags)).toBe('Blue');
		expect(flagLabel('green', undefined)).toBe('Green');
	});
});

describe('flagFilterLabel', () => {
	it('says any flag, the one picked, or how many', () => {
		expect(flagFilterLabel([], flags)).toBe('Any flag');
		expect(flagFilterLabel(['red'], flags)).toBe('Reimbursable');
		expect(flagFilterLabel(['none'], flags)).toBe('No flag');
		expect(flagFilterLabel(['red', 'none'], flags)).toBe('2 flags');
	});
});

describe('toggleFlag', () => {
	it('adds and takes out, keeping the order of the choices', () => {
		expect(toggleFlag(['blue'], 'red')).toEqual(['red', 'blue']);
		expect(toggleFlag(['blue', 'red'], 'none')).toEqual(['none', 'red', 'blue']);
		expect(toggleFlag(['none', 'red'], 'none')).toEqual(['red']);
	});
});

describe('changedFlagNames', () => {
	it('keeps only the names that changed, so an untouched field never clears its flag', () => {
		const before = {
			red: 'Reimbursable',
			orange: '',
			yellow: '',
			green: '',
			blue: 'Trip',
			purple: ''
		};
		const after = { ...before, red: 'Work', blue: '' };
		expect(changedFlagNames(before, after)).toEqual({ red: 'Work', blue: '' });
		expect(changedFlagNames(before, { ...before })).toEqual({});
	});
});
