import { foldText } from './search';

/** How a rule's text must appear in a description: at its start, anywhere, or as all of it. */
export type RuleKind = 'starts' | 'contains' | 'is';

export const RULE_KINDS: readonly RuleKind[] = ['starts', 'contains', 'is'];

/** A rule's text or a description as rules compare them: folded, with single spaces. */
export function ruleText(text: string): string {
	return foldText(text).replace(/\s+/g, ' ').trim();
}

const RANK: Record<RuleKind, number> = { is: 0, starts: 1, contains: 2 };

function catches(kind: RuleKind, text: string, description: string): boolean {
	if (!text) return false;
	if (kind === 'is') return description === text;
	if (kind === 'starts') return description.startsWith(text);
	return description.includes(text);
}

/**
 * The rule that catches `description`, if any. The most specific one wins: `is`, then `starts`,
 * then `contains`; within a kind the longer text; then the older id.
 */
export function matchRule<R extends { id: string; kind: RuleKind; text: string }>(
	rules: readonly R[],
	description: string
): R | null {
	const target = ruleText(description);
	let best: { rule: R; text: string } | null = null;
	for (const rule of rules) {
		const text = ruleText(rule.text);
		if (!catches(rule.kind, text, target)) continue;
		if (
			!best ||
			RANK[rule.kind] < RANK[best.rule.kind] ||
			(rule.kind === best.rule.kind &&
				(text.length > best.text.length ||
					(text.length === best.text.length && rule.id < best.rule.id)))
		)
			best = { rule, text };
	}
	return best?.rule ?? null;
}
