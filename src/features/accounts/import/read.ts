import { DomainError } from '$domain/errors';
import { parseCsv, widest } from './csv';
import { decodeStatement } from './decode';
import { isOfx, parseOfx } from './ofx';
import type { Statement } from './statement';

/** A statement file as read: OFX lines, or a CSV table still to be mapped. */
export type ReadStatement =
	{ kind: 'ofx'; statement: Statement } | { kind: 'csv'; table: string[][] };

/**
 * Reads a statement file's bytes, in `digits` decimal places. STATEMENT_EMPTY when it has no
 * lines, STATEMENT_UNREADABLE when it is neither an OFX nor a CSV with two columns or more.
 */
export function readStatement(bytes: Uint8Array, digits: number): ReadStatement {
	const text = decodeStatement(bytes);
	if (isOfx(text)) {
		const statement = parseOfx(text, digits);
		if (statement.lines.length === 0) throw new DomainError('STATEMENT_EMPTY');
		return { kind: 'ofx', statement };
	}
	if (text.includes('\u0000')) throw new DomainError('STATEMENT_UNREADABLE', 'Binary file');
	const table = parseCsv(text);
	if (table.length === 0) throw new DomainError('STATEMENT_EMPTY');
	if (widest(table) < 2) throw new DomainError('STATEMENT_UNREADABLE', 'Not a table');
	return { kind: 'csv', table };
}
