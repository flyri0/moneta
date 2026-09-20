import { all, ALL_TABLES, type Db, type Table } from '../connection';
import { schemaVersion } from '../migrate';

/**
 * The whole budget as JSON: the `meta` keys, and every other table's rows with their SQL
 * column names and values (booleans are 0/1, amounts are minor units). For reading elsewhere;
 * the `.sqlite` export is the backup that can be restored.
 */
export interface BudgetDump {
	format: 'moneta-budget';
	schemaVersion: number;
	exportedAt: string;
	meta: Record<string, string>;
	tables: Record<Exclude<Table, 'meta'>, Record<string, unknown>[]>;
}

export function dumpBudget(db: Db, now: Date = new Date()): BudgetDump {
	const meta = Object.fromEntries(
		all<{ key: string; value: string }>(db, 'SELECT key, value FROM meta ORDER BY key').map((r) => [
			r.key,
			r.value
		])
	);
	const tables = Object.fromEntries(
		ALL_TABLES.filter((t) => t !== 'meta').map((t) => [
			t,
			all<Record<string, unknown>>(db, `SELECT * FROM ${t} ORDER BY 1, 2`)
		])
	) as BudgetDump['tables'];
	return {
		format: 'moneta-budget',
		schemaVersion: schemaVersion(db),
		exportedAt: now.toISOString(),
		meta,
		tables
	};
}
