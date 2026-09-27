import { uuidv7 } from 'uuidv7';
import { DomainError } from '$domain/errors';
import { RULE_KINDS, ruleText, type RuleKind } from '$domain/payee-rules';
import { all, one, run, tx, type Db } from '../connection';
import { getOrCreatePayee } from './payees';

/** A statement description that `kind`/`text` catches is imported with this payee and category. */
export interface PayeeRule {
	id: string;
	payeeId: string;
	payeeName: string;
	kind: RuleKind;
	text: string;
	/** The category it sets; null leaves the payee's usual one. */
	categoryId: string | null;
}

export interface RuleInput {
	/** The payee's name; a payee that doesn't exist yet is created. */
	payeeName: string;
	kind: RuleKind;
	text: string;
	categoryId: string | null;
}

/** Every rule, by payee name, then kind and text. */
export function listRules(db: Db): PayeeRule[] {
	return all<PayeeRule>(
		db,
		`SELECT r.id, r.payee_id AS payeeId, p.name AS payeeName, r.kind, r.text,
			r.category_id AS categoryId
		 FROM payee_rules r JOIN payees p ON p.id = r.payee_id
		 ORDER BY p.name COLLATE NOCASE, r.kind, r.text COLLATE NOCASE`
	);
}

/** Checks a rule and returns what to store; `except` is the rule being updated. */
function prepare(db: Db, input: RuleInput, except: string | null) {
	if (!RULE_KINDS.includes(input.kind))
		throw new DomainError('INVALID_INPUT', `Unknown rule kind ${input.kind}`);
	const text = input.text.trim();
	if (!ruleText(text)) throw new DomainError('INVALID_INPUT', 'Rule text is required');
	if (
		input.categoryId &&
		!one(db, 'SELECT 1 AS x FROM categories WHERE id = ?', [input.categoryId])
	)
		throw new DomainError('NOT_FOUND', `Category ${input.categoryId} not found`);
	const wanted = ruleText(text);
	const clash = listRules(db).some(
		(r) => r.id !== except && r.kind === input.kind && ruleText(r.text) === wanted
	);
	if (clash) throw new DomainError('RULE_EXISTS');
	const payeeId = getOrCreatePayee(db, input.payeeName);
	if (!payeeId) throw new DomainError('INVALID_INPUT', 'Payee is required');
	return { payeeId, text, categoryId: input.categoryId || null };
}

export function createRule(db: Db, input: RuleInput): string {
	return tx(db, () => {
		const { payeeId, text, categoryId } = prepare(db, input, null);
		const id = uuidv7();
		run(
			db,
			'INSERT INTO payee_rules (id, payee_id, kind, text, category_id) VALUES (?, ?, ?, ?, ?)',
			[id, payeeId, input.kind, text, categoryId]
		);
		return id;
	});
}

export function updateRule(db: Db, id: string, input: RuleInput): void {
	tx(db, () => {
		if (!one(db, 'SELECT 1 AS x FROM payee_rules WHERE id = ?', [id]))
			throw new DomainError('NOT_FOUND', `Rule ${id} not found`);
		const { payeeId, text, categoryId } = prepare(db, input, id);
		run(
			db,
			'UPDATE payee_rules SET payee_id = ?, kind = ?, text = ?, category_id = ? WHERE id = ?',
			[payeeId, input.kind, text, categoryId, id]
		);
	});
}

export function deleteRule(db: Db, id: string): void {
	if (!one(db, 'SELECT 1 AS x FROM payee_rules WHERE id = ?', [id]))
		throw new DomainError('NOT_FOUND', `Rule ${id} not found`);
	run(db, 'DELETE FROM payee_rules WHERE id = ?', [id]);
}
