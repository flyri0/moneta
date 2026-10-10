import type { ImportLine, ImportPreview, StatementLine } from '$db/repos/imports';
import { isFarFuture } from '$domain/month';
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
	/** For a `possible` line: whether the user linked it to the transaction it may be. */
	linked: boolean;
}

/** What importing the row does as the user left it: a possible match is new until linked. */
export function rowStatus(
	row: Pick<ReviewRow, 'preview' | 'linked'>
): 'new' | 'match' | 'duplicate' {
	const { status } = row.preview;
	if (status === 'possible') return row.linked ? 'match' : 'new';
	return status;
}

/** Links a possible match to its transaction (and includes it), or unlinks it. */
export function linkPossible(row: ReviewRow, linked: boolean): void {
	if (row.preview.status !== 'possible') return;
	row.linked = linked;
	if (linked) row.include = true;
}

/**
 * The rows to review: every new or matched line included, possible matches and duplicates left
 * out, with the suggested categories.
 */
export function reviewRows(lines: StatementLine[], previews: ImportPreview[]): ReviewRow[] {
	return lines.map((line, i) => ({
		line,
		preview: previews[i],
		include: previews[i].status === 'new' || previews[i].status === 'match',
		payeeName: previews[i].payeeName,
		categoryId: previews[i].categoryId ?? '',
		ruleId: previews[i].ruleId,
		linked: false
	}));
}

/** Whether a row still needs a category before it can be imported. */
export function needsCategory(row: ReviewRow, onBudget: boolean): boolean {
	return onBudget && row.include && rowStatus(row) === 'new' && !row.categoryId;
}

/** How many included rows create transactions, match ones, and still need a category. */
export function reviewCounts(rows: ReviewRow[], onBudget: boolean) {
	let create = 0;
	let match = 0;
	let missing = 0;
	for (const row of rows) {
		if (!row.include) continue;
		const status = rowStatus(row);
		if (status === 'match') match++;
		else if (status === 'new') create++;
		if (needsCategory(row, onBudget)) missing++;
	}
	return { create, match, missing };
}

/**
 * How many lines to import are dated more than two years ahead, likely a wrong year: the budget
 * is worked out month by month up to the latest date.
 */
export function farFutureCount(rows: ReviewRow[], today: string): number {
	return rows.filter(
		(r) => r.include && rowStatus(r) !== 'duplicate' && isFarFuture(r.line.date, today)
	).length;
}

/** Gives `categoryId` to every included new row that has no category yet. */
export function fillCategories(rows: ReviewRow[], categoryId: string, onBudget: boolean): void {
	for (const row of rows) if (needsCategory(row, onBudget)) row.categoryId = categoryId;
}

/** The lines to send for import: the included ones, new or matched. */
export function importLines(rows: ReviewRow[], onBudget: boolean): ImportLine[] {
	return rows
		.filter((r) => r.include && rowStatus(r) !== 'duplicate')
		.map((r) => {
			const status = rowStatus(r);
			return {
				importId: r.preview.importId,
				date: r.line.date,
				amount: r.line.amount,
				payeeName: r.payeeName.trim(),
				memo: r.line.memo,
				categoryId: onBudget && status === 'new' ? r.categoryId || null : null,
				matchId: status === 'match' ? (r.preview.match?.id ?? null) : null
			};
		});
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
		if (rowStatus(row) !== 'new' || !matchRule([rule], row.line.description)) continue;
		const untouched = row.payeeName === row.preview.payeeName;
		const renamedToIt =
			row.payeeName.trim().toLocaleLowerCase() === rule.payeeName.toLocaleLowerCase();
		if (!untouched && !renamedToIt) continue;
		row.payeeName = rule.payeeName;
		if (rule.categoryId) row.categoryId = rule.categoryId;
		row.ruleId = rule.id;
	}
}
