import { DomainError } from '$domain/errors';
import { FLAG_COLORS, isFlagColor, type FlagColor } from '$domain/flag';
import { all, run, tx, type Db } from '../connection';

/** A flag color and the name the user gave it; null shows the color's default name. */
export interface FlagRow {
	color: FlagColor;
	name: string | null;
}

/** The longest name a flag can have. */
export const FLAG_NAME_MAX = 50;

/** The six flag colors, in order, with their names. */
export function listFlags(db: Db): FlagRow[] {
	const names = new Map(
		all<{ color: FlagColor; name: string }>(db, 'SELECT color, name FROM flags').map((r) => [
			r.color,
			r.name
		])
	);
	// A name of only spaces (from a file written elsewhere) shows the color's, as an empty one does.
	return FLAG_COLORS.map((color) => ({ color, name: names.get(color)?.trim() || null }));
}

/** Names a flag color. An empty name or null goes back to the color's default name. */
export function renameFlag(db: Db, color: FlagColor, name: string | null): void {
	if (!isFlagColor(color)) throw new DomainError('INVALID_INPUT', `Invalid flag ${String(color)}`);
	if (name !== null && typeof name !== 'string')
		throw new DomainError('INVALID_INPUT', 'A flag name must be text');
	const trimmed = name?.trim() ?? '';
	if (trimmed.length > FLAG_NAME_MAX) throw new DomainError('INVALID_INPUT', 'Flag name too long');
	if (!trimmed) run(db, 'DELETE FROM flags WHERE color = ?', [color]);
	else
		run(
			db,
			'INSERT INTO flags (color, name) VALUES (?, ?) ON CONFLICT (color) DO UPDATE SET name = excluded.name',
			[color, trimmed]
		);
}

/** Names several flag colors at once (see `renameFlag`); colors left out keep their name. */
export function renameFlags(db: Db, names: Partial<Record<FlagColor, string | null>>): void {
	tx(db, () => {
		for (const [color, name] of Object.entries(names)) renameFlag(db, color as FlagColor, name);
	});
}
