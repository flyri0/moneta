import { describe, expect, it } from 'vitest';
import { matchRule, ruleText, type RuleKind } from './payee-rules';

const rule = (id: string, kind: RuleKind, text: string) => ({ id, kind, text });

describe('ruleText', () => {
	it('ignores case, accents and extra spaces', () => {
		expect(ruleText('  Padaria   São  JOÃO ')).toBe('padaria sao joao');
	});
});

describe('matchRule', () => {
	const rules = [
		rule('1', 'contains', 'uber'),
		rule('2', 'starts', 'UBER'),
		rule('3', 'starts', 'uber *eats'),
		rule('4', 'is', 'Uber'),
		rule('5', 'starts', 'Açougue')
	];

	it('prefers is, then the longest starts, then contains', () => {
		expect(matchRule(rules, 'uber')?.id).toBe('4');
		expect(matchRule(rules, 'UBER *EATS 123')?.id).toBe('3');
		expect(matchRule(rules, 'UBER *TRIP 8H2K')?.id).toBe('2');
		expect(matchRule(rules, 'PIX UBER DO BRASIL')?.id).toBe('1');
	});

	it('folds the description too', () => {
		expect(matchRule(rules, 'ACOUGUE   BOM')?.id).toBe('5');
	});

	it('returns null when nothing catches it', () => {
		expect(matchRule(rules, 'Padaria')).toBeNull();
		expect(matchRule([], 'uber')).toBeNull();
	});

	it('breaks ties by the older id', () => {
		expect(matchRule([rule('b', 'contains', 'ab'), rule('a', 'contains', 'AB')], 'xaby')?.id).toBe(
			'a'
		);
	});
});
