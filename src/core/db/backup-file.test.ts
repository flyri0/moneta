import { describe, it, expect } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { readBackup, writeBackup } from './backup-file';
import { toImage } from './image';
import { createBudgetDb, loadSqlite } from './testing';

const ID_A = '0190a000-0000-7000-8000-00000000000a';
const ID_B = '0190a000-0000-7000-8000-00000000000b';

async function budgetImage(): Promise<Uint8Array> {
	return toImage(await loadSqlite(), await createBudgetDb());
}

/** A `.moneta` zip whose manifest is `manifest`, plus the given files. */
function zipWith(manifest: unknown, files: Record<string, Uint8Array> = {}): Uint8Array {
	return zipSync({ 'moneta.json': strToU8(JSON.stringify(manifest)), ...files });
}

function manifest(overrides: Record<string, unknown> = {}) {
	return {
		format: 'moneta-backup',
		version: 1,
		createdAt: '2026-09-22T12:00:00.000Z',
		encryption: null,
		budgets: [{ id: ID_A, name: 'Home', path: `budgets/${ID_A}.sqlite` }],
		...overrides
	};
}

describe('writeBackup', () => {
	it('writes a zip with a manifest first and one .sqlite per budget', async () => {
		const image = await budgetImage();
		const bytes = writeBackup(
			[
				{ id: ID_A, name: 'Home', image },
				{ id: ID_B, name: 'Trip', image }
			],
			'2026-09-22T12:00:00.000Z'
		);
		const files = unzipSync(bytes);
		expect(Object.keys(files)).toEqual([
			'moneta.json',
			`budgets/${ID_A}.sqlite`,
			`budgets/${ID_B}.sqlite`
		]);
		expect(JSON.parse(strFromU8(files['moneta.json']))).toEqual({
			format: 'moneta-backup',
			version: 1,
			createdAt: '2026-09-22T12:00:00.000Z',
			encryption: null,
			budgets: [
				{ id: ID_A, name: 'Home', path: `budgets/${ID_A}.sqlite` },
				{ id: ID_B, name: 'Trip', path: `budgets/${ID_B}.sqlite` }
			]
		});
		expect(files[`budgets/${ID_B}.sqlite`]).toEqual(image);
		// SQLite pages compress well.
		expect(bytes.length).toBeLessThan(image.length);
	});
});

describe('readBackup', () => {
	it('reads back what writeBackup wrote', async () => {
		const image = await budgetImage();
		const contents = readBackup(
			writeBackup([{ id: ID_A, name: 'Home', image }], '2026-09-22T12:00:00.000Z')
		);
		expect(contents).toEqual({
			createdAt: '2026-09-22T12:00:00.000Z',
			budgets: [{ id: ID_A, name: 'Home', image }]
		});
	});

	it('reads a legacy .sqlite backup as one budget without an id', async () => {
		const image = await budgetImage();
		expect(readBackup(image)).toEqual({
			createdAt: null,
			budgets: [{ id: null, name: null, image }]
		});
	});

	it('rejects files that are neither', () => {
		const text = strToU8('Date,Payee,Amount\n'.repeat(64));
		expect(() => readBackup(text)).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_RECOGNIZED' })
		);
		expect(() => readBackup(new Uint8Array())).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_RECOGNIZED' })
		);
	});

	it('rejects zips that are not Moneta backups', () => {
		expect(() => readBackup(zipSync({ 'notes.txt': strToU8('hi') }))).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_RECOGNIZED' })
		);
		expect(() => readBackup(zipWith(manifest({ format: 'something-else' })))).toThrow(
			expect.objectContaining({ code: 'BACKUP_NOT_RECOGNIZED' })
		);
	});

	it('rejects backups from a newer version, and encrypted ones', async () => {
		const files = { [`budgets/${ID_A}.sqlite`]: await budgetImage() };
		expect(() => readBackup(zipWith(manifest({ version: 2 }), files))).toThrow(
			expect.objectContaining({ code: 'BACKUP_TOO_NEW' })
		);
		const encryption = { alg: 'AES-256-GCM' };
		expect(() => readBackup(zipWith(manifest({ encryption }), files))).toThrow(
			expect.objectContaining({ code: 'BACKUP_ENCRYPTED' })
		);
	});

	it('rejects damaged zips and manifests', async () => {
		const image = await budgetImage();
		const files = { [`budgets/${ID_A}.sqlite`]: image };
		const cut = writeBackup([{ id: ID_A, name: 'Home', image }], 'x').slice(0, 200);
		const damaged = [
			cut,
			zipSync({ 'moneta.json': strToU8('{ not json') }),
			zipWith(manifest({ version: 'one' }), files),
			zipWith(manifest({ budgets: 'all' }), files),
			zipWith(manifest()),
			zipWith(manifest({ budgets: [{ id: '../x', name: 'Home', path: 'budgets/x' }] }), {
				'budgets/x': image
			}),
			zipWith(
				manifest({
					budgets: [
						{ id: ID_A, name: 'Home', path: `budgets/${ID_A}.sqlite` },
						{ id: ID_A, name: 'Again', path: `budgets/${ID_A}.sqlite` }
					]
				}),
				files
			)
		];
		for (const bytes of damaged)
			expect(() => readBackup(bytes)).toThrow(expect.objectContaining({ code: 'BACKUP_DAMAGED' }));
	});
});
