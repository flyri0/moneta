import { describe, expect, it } from 'vitest';
import { run } from '../connection';
import { createBudgetDb } from '../testing';
import { listFlags, renameFlag, renameFlags } from './flags';

describe('flags', () => {
	it('lists the six colors, unnamed at first', async () => {
		const db = await createBudgetDb();
		expect(listFlags(db)).toEqual([
			{ color: 'red', name: null },
			{ color: 'orange', name: null },
			{ color: 'yellow', name: null },
			{ color: 'green', name: null },
			{ color: 'blue', name: null },
			{ color: 'purple', name: null }
		]);
	});

	it('renames a color, trimmed, and an empty name goes back to the default', async () => {
		const db = await createBudgetDb();
		renameFlag(db, 'red', '  Reimbursable ');
		expect(listFlags(db)[0]).toEqual({ color: 'red', name: 'Reimbursable' });
		renameFlag(db, 'red', 'To claim');
		expect(listFlags(db)[0]).toEqual({ color: 'red', name: 'To claim' });
		renameFlag(db, 'red', '  ');
		expect(listFlags(db)[0]).toEqual({ color: 'red', name: null });
		renameFlag(db, 'blue', null);
		expect(listFlags(db)[4]).toEqual({ color: 'blue', name: null });
	});

	it('shows the color for a name of only spaces', async () => {
		const db = await createBudgetDb();
		run(db, "INSERT INTO flags (color, name) VALUES ('red', '  ')");
		expect(listFlags(db)[0]).toEqual({ color: 'red', name: null });
	});

	it('renames several at once', async () => {
		const db = await createBudgetDb();
		renameFlag(db, 'green', 'Old');
		renameFlags(db, { red: 'Trip', green: '' });
		expect(listFlags(db).filter((f) => f.name)).toEqual([{ color: 'red', name: 'Trip' }]);
	});

	it('refuses an unknown color or a long name', async () => {
		const db = await createBudgetDb();
		expect(() => renameFlag(db, 'pink' as 'red', 'x')).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(() => renameFlag(db, 'red', 'x'.repeat(51))).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(() => renameFlags(db, { red: 1 as unknown as string })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});
