import { beforeAll, describe, it, expect } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { DomainError } from '$domain/errors';
import { newRecoveryKey } from '$domain/recovery-key';
import { createKeys, type BackupKeys } from './backup-crypto';
import { isSealed, openSealed, readBackup, sealBackup, writeBackup } from './backup-file';
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

describe('sealBackup and openSealed', () => {
	const PASSWORD = 'correct horse';
	const RECOVERY = newRecoveryKey();
	let keys: BackupKeys;
	let inner: Uint8Array<ArrayBuffer>;
	let sealed: Uint8Array;

	beforeAll(async () => {
		keys = await createKeys(PASSWORD, RECOVERY, 1000);
		inner = writeBackup(
			[{ id: ID_A, name: 'Home', image: await budgetImage() }],
			'2026-09-22T12:00:00.000Z'
		);
		sealed = await sealBackup(inner, keys);
	});

	async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
		try {
			await promise;
		} catch (err) {
			if (err instanceof DomainError) return err.code;
			throw err;
		}
		return undefined;
	}

	/** `sealed` with its manifest and files changed. */
	function resealed(
		change: (manifest: Record<string, unknown>, files: Record<string, Uint8Array>) => void
	): Uint8Array {
		const files = unzipSync(sealed);
		const json = JSON.parse(strFromU8(files['moneta.json']));
		change(json, files);
		return zipSync({ ...files, 'moneta.json': strToU8(JSON.stringify(json)) });
	}

	it('keeps only the encryption settings and the encrypted payload in the open', () => {
		const files = unzipSync(sealed);
		expect(Object.keys(files)).toEqual(['moneta.json', 'payload.bin']);
		const json = JSON.parse(strFromU8(files['moneta.json']));
		expect(Object.keys(json)).toEqual(['format', 'version', 'encryption']);
		expect(json).toMatchObject({
			format: 'moneta-backup',
			version: 1,
			encryption: {
				cipher: 'AES-256-GCM',
				keys: [{ type: 'password' }, { type: 'recovery' }]
			}
		});
		expect(strFromU8(sealed, true)).not.toContain('Home');
	});

	it('opens with the password or the recovery key, giving back the plain backup', async () => {
		expect(await openSealed(sealed, { password: PASSWORD })).toEqual(inner);
		expect(await openSealed(sealed, { recoveryKey: RECOVERY })).toEqual(inner);
	});

	it('uses a new IV for every backup', async () => {
		const again = await sealBackup(inner, keys);
		const ivOf = (bytes: Uint8Array) =>
			JSON.parse(strFromU8(unzipSync(bytes)['moneta.json'])).encryption.iv;
		expect(ivOf(again)).not.toBe(ivOf(sealed));
	});

	it('is refused by readBackup, as by apps without encryption', () => {
		expect(() => readBackup(sealed)).toThrow(expect.objectContaining({ code: 'BACKUP_ENCRYPTED' }));
	});

	it('stamps its entries with a fixed date, not the time it was made', () => {
		const stamps: [number, number][] = [];
		for (let i = 0; i + 30 < sealed.length; i++) {
			const local =
				sealed[i] === 0x50 && sealed[i + 1] === 0x4b && sealed[i + 2] === 3 && sealed[i + 3] === 4;
			if (!local) continue;
			const view = new DataView(sealed.buffer, sealed.byteOffset + i);
			stamps.push([view.getUint16(10, true), view.getUint16(12, true)]);
		}
		// DOS time 00:00:00 and date 1980-01-01.
		expect(stamps).toEqual([
			[0, 0x21],
			[0, 0x21]
		]);
	});

	it('tells encrypted backups from the rest', async () => {
		expect(isSealed(sealed)).toBe(true);
		expect(isSealed(inner)).toBe(false);
		expect(isSealed(await budgetImage())).toBe(false);
		expect(isSealed(strToU8('hello'))).toBe(false);
		expect(isSealed(sealed.slice(0, 100))).toBe(false);
	});

	it('tells an encrypted backup from its manifest alone, without unpacking the payload', () => {
		// Claim the payload unpacks to ~4 GiB: unpacking it all would trip the ZIP bomb check.
		const bytes = sealed.slice();
		const name = strToU8('payload.bin');
		for (let i = 0; i + 46 < bytes.length; i++) {
			const central =
				bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 1 && bytes[i + 3] === 2;
			if (central && name.every((c, j) => bytes[i + 46 + j] === c))
				bytes.set([0xf0, 0xff, 0xff, 0xff], i + 24);
		}
		expect(isSealed(bytes)).toBe(true);
	});

	it('rejects a wrong secret, or any change to the manifest', async () => {
		expect(await codeOf(openSealed(sealed, { password: 'wrong horse' }))).toBe('BACKUP_WRONG_KEY');
		const changed = resealed((json) => (json.note = 'hi'));
		expect(await codeOf(openSealed(changed, { password: PASSWORD }))).toBe('BACKUP_WRONG_KEY');
	});

	it('reports unknown ciphers and newer versions as BACKUP_TOO_NEW', async () => {
		const cipher = resealed((json) => ((json.encryption as Record<string, unknown>).cipher = 'X'));
		const version = resealed((json) => (json.version = 2));
		for (const bytes of [cipher, version])
			expect(await codeOf(openSealed(bytes, { password: PASSWORD }))).toBe('BACKUP_TOO_NEW');
	});

	it('reports a bad IV or a missing payload as BACKUP_DAMAGED', async () => {
		const iv = resealed((json) => ((json.encryption as Record<string, unknown>).iv = 'AAAA'));
		const payload = resealed((_, files) => delete files['payload.bin']);
		for (const bytes of [iv, payload])
			expect(await codeOf(openSealed(bytes, { password: PASSWORD }))).toBe('BACKUP_DAMAGED');
	});

	it('refuses a backup that is not encrypted', async () => {
		expect(await codeOf(openSealed(inner, { password: PASSWORD }))).toBe('INVALID_INPUT');
	});
});
