import type { RuleKind } from '$domain/payee-rules';
import { m } from '$i18n/paraglide/messages';

/** A saved rule, as the rule form hands it back. */
export interface SavedRule {
	id: string;
	kind: RuleKind;
	text: string;
	payeeName: string;
	categoryId: string | null;
}

/** A rule as the form edits it. */
export interface RuleDraft {
	kind: RuleKind;
	text: string;
	payeeName: string;
	/** '' for the payee's usual category. */
	categoryId: string;
}

/** Card processors that put their own code before the merchant's name: `PAG*CORNERMKT`. */
const PROCESSORS = ['PAG', 'SQ', 'PAYPAL', 'TST', 'MP', 'PICPAY', 'IZ'];

/**
 * A rule to start from for a statement description: "starts with" its first words, up to the
 * first `*`, number or wide gap, where banks put what changes between charges ("UBER *TRIP 8H2K"
 * gives "UBER"). After a card processor's prefix (`PAG*`), it is Contains with the merchant's name
 * instead.
 */
export function ruleDraft(description: string, payeeName: string, categoryId = ''): RuleDraft {
	const processed = /^\s*([A-Za-z]+)\s*\*\s*(.+)$/s.exec(description);
	if (processed && PROCESSORS.includes(processed[1].toUpperCase())) {
		const merchant = processed[2]
			.split(/\d|\s{2,}/)[0]
			.replace(/\s+/g, ' ')
			.trim();
		if (merchant) return { kind: 'contains', text: merchant, payeeName, categoryId };
	}
	const clean = description.replace(/\s+/g, ' ').trim();
	const head = description
		.split(/\*|\d|\s{2,}/)[0]
		.replace(/\s+/g, ' ')
		.trim();
	return { kind: 'starts', text: head || clean, payeeName, categoryId };
}

/** The kinds as the form offers them. */
export function kindLabel(kind: RuleKind): string {
	return kind === 'starts'
		? m.payee_rule_kind_starts()
		: kind === 'contains'
			? m.payee_rule_kind_contains()
			: m.payee_rule_kind_is();
}

/** A rule in a list: `Starts with “UBER”`. */
export function ruleSummary(rule: { kind: RuleKind; text: string }): string {
	return m.payee_rule_summary({ kind: kindLabel(rule.kind), text: rule.text });
}
