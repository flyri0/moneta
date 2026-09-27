import type { ImportLine, ImportPreview, StatementLine } from '$db/repos/imports';
import { matchRule, type RuleKind } from '$domain/payee-rules';

/** A statement line on the review screen, with what the user chose for it. */
export interface ReviewRow {
	line: StatementLine;
	preview: ImportPreview;
	/** Whether it is imported; duplicates never are. */
	include: boolean;
	payeeName: string;
	/** The category of a new line ('' for none yet). */
	categoryId: string;
	/** The payee rule that set its payee, if any. */
	ruleId: string | null;
}

/** The rows to review: every line but duplicates included, with the suggested categories. */
export function reviewRows(lines: StatementLine[], previews: ImportPreview[]): ReviewRow[] {
	return lines.map((line, i) => ({
		line,
		preview: previews[i],
		include: previews[i].status !== 'duplicate',
		payeeName: previews[i].payeeName,
		categoryId: previews[i].categoryId ?? '',
		ruleId: previews[i].ruleId
	}));
}

/** Whether a row still needs a category before it can be imported. */
export function needsCategory(row: ReviewRow, onBudget: boolean): boolean {
	return onBudget && row.include && row.preview.status === 'new' && !row.categoryId;
}

/** How many included rows create transactions, match ones, and still need a category. */
export function reviewCounts(rows: ReviewRow[], onBudget: boolean) {
	let create = 0;
	let match = 0;
	let missing = 0;
	for (const row of rows) {
		if (!row.include) continue;
		if (row.preview.status === 'match') match++;
		else if (row.preview.status === 'new') create++;
		if (needsCategory(row, onBudget)) missing++;
	}
	return { create, match, missing };
}

/** Gives `categoryId` to every included new row that has no category yet. */
export function fillCategories(rows: ReviewRow[], categoryId: string, onBudget: boolean): void {
	for (const row of rows) if (needsCategory(row, onBudget)) row.categoryId = categoryId;
}

/** The lines to send for import: the included ones, new or matched. */
export function importLines(rows: ReviewRow[], onBudget: boolean): ImportLine[] {
	return rows
		.filter((r) => r.include && r.preview.status !== 'duplicate')
		.map((r) => ({
			importId: r.line.importId,
			date: r.line.date,
			amount: r.line.amount,
			payeeName: r.payeeName.trim(),
			memo: r.line.memo,
			categoryId: onBudget && r.preview.status === 'new' ? r.categoryId || null : null,
			matchId: r.preview.match?.id ?? null
		}));
}

/** A rule as `applyRule` needs it. */
export interface ReviewRule {
	id: string;
	kind: RuleKind;
	text: string;
	payeeName: string;
	categoryId: string | null;
}

/**
 * Gives a rule made during the review to the new lines it catches whose payee is still the one the
 * preview gave them. A line the user already renamed keeps its payee; the rule's category, when it
 * has one, replaces the line's.
 */
export function applyRule(rows: ReviewRow[], rule: ReviewRule): void {
	for (const row of rows) {
		if (row.preview.status !== 'new' || !matchRule([rule], row.line.description)) continue;
		const untouched = row.payeeName === row.preview.payeeName;
		const renamedToIt =
			row.payeeName.trim().toLocaleLowerCase() === rule.payeeName.toLocaleLowerCase();
		if (!untouched && !renamedToIt) continue;
		row.payeeName = rule.payeeName;
		if (rule.categoryId) row.categoryId = rule.categoryId;
		row.ruleId = rule.id;
	}
}
