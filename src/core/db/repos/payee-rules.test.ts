import { beforeEach, describe, expect, it } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import type { Db } from '../connection';
import { createRule, deleteRule, listRules, updateRule } from './payee-rules';
import { getOrCreatePayee, listPayees } from './payees';

const code = (c: string) => expect.objectContaining({ code: c });

let db: Db;
let food: string;
let fun: string;

beforeEach(async () => {
	db = await createBudgetDb();
	food = categoryId(db, 'Food');
	fun = categoryId(db, 'Fun');
});

describe('payee rules', () => {
	it('creates a rule for a payee named, creating the payee if needed', () => {
		const id = createRule(db, {
			payeeName: ' Uber ',
			kind: 'starts',
			text: ' UBER ',
			categoryId: fun
		});
		expect(listRules(db)).toEqual([
			{
				id,
				payeeId: expect.any(String),
				payeeName: 'Uber',
				kind: 'starts',
				text: 'UBER',
				categoryId: fun
			}
		]);
		expect(listPayees(db).map((p) => [p.name, p.rules])).toEqual([['Uber', 1]]);
	});

	it('uses an existing payee, case-insensitively', () => {
		const uber = getOrCreatePayee(db, 'Uber')!;
		createRule(db, { payeeName: 'uber', kind: 'contains', text: 'uber', categoryId: null });
		expect(listRules(db)[0].payeeId).toBe(uber);
	});

	it('refuses the same kind and text twice, ignoring case and accents', () => {
		createRule(db, { payeeName: 'Açougue', kind: 'starts', text: 'Açougue', categoryId: null });
		expect(() =>
			createRule(db, { payeeName: 'Other', kind: 'starts', text: ' ACOUGUE ', categoryId: null })
		).toThrow(code('RULE_EXISTS'));
		expect(() =>
			createRule(db, { payeeName: 'Other', kind: 'contains', text: 'acougue', categoryId: null })
		).not.toThrow();
	});

	it('refuses a blank text, an unknown kind or category, and a blank payee', () => {
		const base = { payeeName: 'Uber', kind: 'starts' as const, text: 'UBER', categoryId: null };
		expect(() => createRule(db, { ...base, text: '  ' })).toThrow(code('INVALID_INPUT'));
		expect(() => createRule(db, { ...base, kind: 'ends' as 'is' })).toThrow(code('INVALID_INPUT'));
		expect(() => createRule(db, { ...base, categoryId: 'nope' })).toThrow(code('NOT_FOUND'));
		expect(() => createRule(db, { ...base, payeeName: ' ' })).toThrow(code('INVALID_INPUT'));
		expect(listRules(db)).toEqual([]);
	});

	it('updates a rule, keeping its own text free to repeat', () => {
		const id = createRule(db, {
			payeeName: 'Uber',
			kind: 'starts',
			text: 'UBER',
			categoryId: null
		});
		updateRule(db, id, { payeeName: 'Uber Eats', kind: 'starts', text: 'uber', categoryId: food });
		expect(listRules(db)[0]).toMatchObject({
			payeeName: 'Uber Eats',
			text: 'uber',
			categoryId: food
		});
		expect(() =>
			updateRule(db, 'nope', { payeeName: 'X', kind: 'is', text: 'x', categoryId: null })
		).toThrow(code('NOT_FOUND'));
	});

	it('deletes a rule', () => {
		const id = createRule(db, {
			payeeName: 'Uber',
			kind: 'starts',
			text: 'UBER',
			categoryId: null
		});
		deleteRule(db, id);
		expect(listRules(db)).toEqual([]);
		expect(() => deleteRule(db, id)).toThrow(code('NOT_FOUND'));
	});
});
