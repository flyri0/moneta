import { describe, it, expect } from 'vitest';
import { nameConfirms } from './delete-confirm';

describe('nameConfirms', () => {
	it('confirms the exact name', () => {
		expect(nameConfirms('Home', 'Home')).toBe(true);
	});

	it('ignores spaces around either side', () => {
		expect(nameConfirms('  Home ', 'Home')).toBe(true);
		expect(nameConfirms('Home', ' Home ')).toBe(true);
	});

	it('does not confirm a different case', () => {
		expect(nameConfirms('home', 'Home')).toBe(false);
	});

	it('does not confirm part of the name', () => {
		expect(nameConfirms('Hom', 'Home')).toBe(false);
		expect(nameConfirms('', 'Home')).toBe(false);
	});

	it('treats composed and decomposed accents alike', () => {
		expect(nameConfirms('Orçamento', 'Orçamento')).toBe(true);
	});

	it('asks for nothing when the budget has no name', () => {
		expect(nameConfirms('', '  ')).toBe(true);
	});
});
